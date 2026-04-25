import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedis } from '../../lib/redis';

const REDIS_TIMEOUT_MS = 30000;

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
    try {
        const redis = getRedis({ readOnly: true });
        const data = await Promise.race([
            redis.get('mtproto_proxies'),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Redis request timed out')), REDIS_TIMEOUT_MS)
            ),
        ]);

        const proxies = typeof data === 'string' ? JSON.parse(data) : (data || []);
        res.status(200).json(proxies);
    } catch (e) {
        res.status(503).json({
            error: e instanceof Error ? e.message : 'Failed to load proxies',
            proxies: [],
        });
    }
}
