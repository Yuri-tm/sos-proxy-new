import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedis } from '../../lib/redis';

const REDIS_TIMEOUT_MS = 30000;

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    try {
        const redis = getRedis({ readOnly: true, timeoutMs: REDIS_TIMEOUT_MS });
        const data = await redis.get('mtproto_proxies');

        const proxies = typeof data === 'string' ? JSON.parse(data) : (data || []);
        res.status(200).json(proxies);
    } catch (e) {
        res.status(503).json({
            error: e instanceof Error ? e.message : 'Failed to load proxies',
            proxies: [],
        });
    }
}
