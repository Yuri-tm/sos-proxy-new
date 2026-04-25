import { Redis } from '@upstash/redis';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN in your environment.`
    );
  }
  return value;
}

export function getRedis(options?: { readOnly?: boolean }): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_URL;

  const token = options?.readOnly
    ? process.env.UPSTASH_REDIS_REST_TOKEN ??
      process.env.KV_REST_API_READ_ONLY_TOKEN ??
      process.env.KV_REST_API_TOKEN ??
      process.env.UPSTASH_REDIS_REST_TOKEN
    : process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  return new Redis({
    url: requireEnv('Redis REST URL', url),
    token: requireEnv('Redis REST token', token),
  });
}

