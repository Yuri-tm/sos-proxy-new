import type { NextApiRequest, NextApiResponse } from 'next';
import { getRedis } from '../../lib/redis';
const PROXY_URL = 'https://raw.githubusercontent.com/Grim1313/mtproto-for-telegram/master/all_proxies.txt';

function normalizeProxyLink(link: string): string {
    const trimmed = link.trim();
    // Upstream lists often use https://t.me/proxy?... which Telegram also understands.
    // Normalize everything to tg://proxy?... so our TCP checker can parse consistently.
    if (/^https?:\/\/t\.me\/proxy\b/i.test(trimmed)) {
        return trimmed.replace(/^https?:\/\/t\.me\/proxy\b/i, 'tg://proxy');
    }
    return trimmed;
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
    try {
        const redis = getRedis();
        const response = await fetch(PROXY_URL);
        const text = await response.text();

        // Извлекаем ссылки, убираем пробелы и дубликаты
        const rawLinks = text.split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .filter((l) => l.startsWith('tg://proxy') || /^https?:\/\/t\.me\/proxy\b/i.test(l))
            .map(normalizeProxyLink);

        const uniqueLinks = Array.from(new Set(rawLinks));

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
        res.status(500).json({ error: 'Failed to fetch proxies from GitHub' });
    }
}
