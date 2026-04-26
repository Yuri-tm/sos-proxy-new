import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedis } from '../../lib/redis';
const PROXY_URL = 'https://raw.githubusercontent.com/Grim1313/mtproto-for-telegram/master/all_proxies.txt';
const REDIS_TIMEOUT_MS = 30000;

function normalizeProxyLink(link: string): string {
    const trimmed = link.trim();
    // Upstream lists often use https://t.me/proxy?... which Telegram also understands.
    // Normalize everything to tg://proxy?... so our TCP checker can parse consistently.
    if (/^https?:\/\/t\.me\/proxy\b/i.test(trimmed)) {
        return trimmed.replace(/^https?:\/\/t\.me\/proxy\b/i, 'tg://proxy');
    }
    return trimmed;
}

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

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    try {
        const redis = getRedis({ timeoutMs: REDIS_TIMEOUT_MS });
        const response = await fetch(PROXY_URL);
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Upstream proxy source failed: ${response.status} ${text.slice(0, 200)}`);
        }

        const text = await response.text();

        // Извлекаем ссылки, убираем пробелы и дубликаты
        const rawLinks = text.split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .filter((l) => l.startsWith('tg://proxy') || /^https?:\/\/t\.me\/proxy\b/i.test(l))
            .map(normalizeProxyLink);

        const uniqueLinks = Array.from(new Set(rawLinks)).filter(isValidProxyUrl);
        if (uniqueLinks.length === 0) {
            throw new Error('Upstream proxy source returned no valid proxies');
        }

        // Формируем объект для хранения
        const proxyData = uniqueLinks.map(link => ({
            url: link,
            status: 'pending',
            lastChecked: new Date().toISOString()
        }));

        // Сохраняем в Redis под ключом 'mtproto_proxies'
        await redis.set('mtproto_proxies', JSON.stringify(proxyData));

        res.status(200).json({
            success: true,
            message: 'Proxies fetched and deduplicated',
            count: uniqueLinks.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to fetch proxies from GitHub'
        });
    }
}
