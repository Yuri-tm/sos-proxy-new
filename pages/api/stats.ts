import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedis } from '../../lib/redis';
import type { ProxyRecord } from '../../lib/types';

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

const REDIS_TIMEOUT_MS = 30000;

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  try {
    const redis = getRedis({ readOnly: true, timeoutMs: REDIS_TIMEOUT_MS });
    const data = await redis.get('mtproto_proxies');
    const proxies = safeParseProxies(data);

    let available = 0;
    let unavailable = 0;
    let pending = 0;
    let lastCheckedMax: string | null = null;

    for (const p of proxies) {
      if (p?.status === 'available') available += 1;
      else if (p?.status === 'unavailable') unavailable += 1;
      else pending += 1;

      if (typeof p?.lastChecked === 'string') {
        if (!lastCheckedMax || p.lastChecked > lastCheckedMax) lastCheckedMax = p.lastChecked;
      }
    }

    res.status(200).json({
      total: proxies.length,
      available,
      unavailable,
      pending,
      lastChecked: lastCheckedMax,
    });
  } catch (e) {
    res.status(503).json({
      error: e instanceof Error ? e.message : 'Failed to load stats',
      total: 0,
      available: 0,
      unavailable: 0,
      pending: 0,
      lastChecked: null,
    });
  }
}
