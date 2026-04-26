import type { NextApiRequest, NextApiResponse } from 'next';
import net from 'net';
import pLimit from 'p-limit';
import { getRedis } from '../../lib/redis';
import type { ProxyRecord, ProxyStatus } from '../../lib/types';

const limit = pLimit(10); // Максимум 10 одновременных TCP соединений
const REDIS_TIMEOUT_MS = 30000;

function isValidProxyUrl(url: string): boolean {
    try {
        const parsed = new URL(url.replace('tg://proxy', 'http://temp'));
        const host = parsed.searchParams.get('server');
        const port = parseInt(parsed.searchParams.get('port') || '0');

        // Validate port range and host
        if (port < 1 || port > 65535) return false;
        if (!host || host.length > 255) return false;
        if (!/^[a-zA-Z0-9.-]+$/.test(host)) return false;
        return true;
    } catch {
        return false;
    }
}

function safeParseProxies(data: unknown): ProxyRecord[] {
    if (!data) return [];
    if (Array.isArray(data)) return data as ProxyRecord[];
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? (parsed as ProxyRecord[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

function statusRank(s: ProxyStatus | undefined): number {
    // Prefer moving "pending" to a real state first.
    if (s === 'pending') return 0;
    if (s === 'unavailable') return 1;
    return 2; // available last
}

async function checkTcp(proxyUrl: string): Promise<boolean> {
    try {
        const normalized = /^https?:\/\/t\.me\/proxy\b/i.test(proxyUrl)
            ? proxyUrl.replace(/^https?:\/\/t\.me\/proxy\b/i, 'tg://proxy')
            : proxyUrl;

        const url = new URL(normalized.replace('tg://proxy', 'http://temp.host'));
        const host = url.searchParams.get('server');
        const portStr = url.searchParams.get('port');
        const port = portStr ? parseInt(portStr, 10) : 0;

        // Validate port range
        if (!host || port < 1 || port > 65535) return false;

        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2500); // Таймаут 2.5 секунды

            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
            socket.on('error', () => { socket.destroy(); resolve(false); });

            socket.connect(port, host);
        });
    } catch {
        return false;
    }
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    try {
        const redis = getRedis({ timeoutMs: REDIS_TIMEOUT_MS });
        const data: unknown = await redis.get('mtproto_proxies');

        const proxies = safeParseProxies(data);
        if (proxies.length === 0) return res.status(404).json({ error: 'No proxies in database' });

        const indexed = proxies.map((p, idx) => ({ p, idx }));
        indexed.sort((a, b) => {
            const r = statusRank(a.p.status) - statusRank(b.p.status);
            if (r !== 0) return r;
            // older checks first (ISO strings compare lexicographically)
            return (a.p.lastChecked || '').localeCompare(b.p.lastChecked || '');
        });

        // Check up to 40 items per call (keeps it within typical time limits)
        const toCheck = indexed.slice(0, 40);
        const startedAt = new Date().toISOString();

        const checked = await Promise.all(
            toCheck.map(({ p, idx }) =>
                limit(async () => {
                    const isAlive = await checkTcp(p.url);
                    return {
                        idx,
                        record: {
                            ...p,
                            status: isAlive ? 'available' : 'unavailable',
                            lastChecked: new Date().toISOString(),
                        } satisfies ProxyRecord,
                    };
                })
            )
        );

        // Apply updates in-place, preserving overall ordering in the UI.
        for (const u of checked) {
            proxies[u.idx] = u.record;
        }

        // Filter out invalid proxies to clean up the database
        const cleanProxies = proxies.filter(p => isValidProxyUrl(p.url));

        await redis.set('mtproto_proxies', JSON.stringify(cleanProxies));

        const counts = proxies.reduce(
            (acc, p) => {
                acc[p.status] += 1;
                return acc;
            },
            { available: 0, unavailable: 0, pending: 0 } as Record<ProxyStatus, number>
        );

        res.status(200).json({
            success: true,
            startedAt,
            finishedAt: new Date().toISOString(),
            checked: checked.length,
            counts,
        });
    } catch (e) {
        res.status(503).json({
            error: e instanceof Error ? e.message : 'check-ping failed',
            success: false,
        });
    }
}
