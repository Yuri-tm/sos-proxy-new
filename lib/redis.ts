import http from 'node:http';
import https from 'node:https';

type RedisValue = string | number | boolean | null;

interface RedisCommandResponse<T> {
  result?: T;
  error?: string;
}

export interface RedisClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: RedisValue): Promise<string>;
}

interface RedisClientOptions {
  readOnly?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 250;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN in your environment.`
    );
  }
  return value;
}

function normalizeEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getRedisConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.KV_REST_API_READ_ONLY_TOKEN;

  return {
    url: normalizeEnvValue(requireEnv('Redis REST URL', url)).replace(/\/+$/, ''),
    token: normalizeEnvValue(requireEnv('Redis REST token', token)),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = 'code' in error ? String((error as NodeJS.ErrnoException).code ?? '') : '';
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    error.message.includes('socket hang up') ||
    error.message.includes('Redis request timed out')
  );
}

async function requestJson<T>(
  method: 'GET' | 'POST',
  path: string,
  token: string,
  timeoutMs: number,
  body?: string
): Promise<RedisCommandResponse<T>> {
  const { url } = getRedisConfig();
  const target = new URL(`${url}${path}`);
  const transport = target.protocol === 'https:' ? https : http;

  return new Promise<RedisCommandResponse<T>>((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method,
        agent: false,
        headers: {
          authorization: `Bearer ${token}`,
          connection: 'close',
          ...(body
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body).toString(),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let settled = false;

        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };

        const succeed = (payload: RedisCommandResponse<T>) => {
          if (settled) return;
          settled = true;
          resolve(payload);
        };

        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on('aborted', () => {
          fail(new Error('Redis response was aborted'));
        });

        res.on('error', (error) => {
          fail(error);
        });

        res.on('end', () => {
          if (settled) return;
          const text = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode ?? 0;

          if (statusCode < 200 || statusCode >= 300) {
            fail(new Error(`Redis HTTP ${statusCode}: ${text.slice(0, 200)}`));
            return;
          }

          try {
            succeed(JSON.parse(text) as RedisCommandResponse<T>);
          } catch {
            fail(new Error(`Redis response was not JSON: ${text.slice(0, 200)}`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Redis request timed out'));
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function runRedisGet<T>(key: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { token } = getRedisConfig();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const payload = await requestJson<T>('GET', `/get/${encodeURIComponent(key)}`, token, timeoutMs);

      if (payload.error) {
        throw new Error(`Redis command failed: ${payload.error}`);
      }

      return payload.result as T;
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Redis GET failed');
}

async function runRedisCommand<T>(command: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { token } = getRedisConfig();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const payload = await requestJson<T>('POST', '', token, timeoutMs, JSON.stringify(command));

      if (payload.error) {
        throw new Error(`Redis command failed: ${payload.error}`);
      }

      return payload.result as T;
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === MAX_RETRIES - 1) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Redis command failed');
}

export function getRedis(options?: RedisClientOptions): RedisClient {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    get(key: string) {
      return runRedisGet<unknown>(key, timeoutMs);
    },
    set(key: string, value: RedisValue) {
      return runRedisCommand<string>(['SET', key, value === null ? '' : String(value)], timeoutMs);
    },
  };
}
