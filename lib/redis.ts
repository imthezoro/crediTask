import { Redis } from '@upstash/redis';
// no env imports required here

let client: Redis | null = null;

const memory: Record<string, unknown> = {};

function ensureClient(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export const redis = {
  async get<T>(key: string): Promise<T | null> {
    const c = ensureClient();
    if (!c) return (key in memory ? (memory[key] as T) : null);
    return (await c.get(key)) as T | null;
  },
  async set(key: string, value: unknown, opts?: { ex?: number }) {
    const c = ensureClient();
    if (!c) {
      memory[key] = typeof value === 'string' ? value : JSON.stringify(value);
      if (opts?.ex) {
        setTimeout(() => delete memory[key], opts.ex * 1000).unref?.();
      }
      return;
    }
    const normalized = (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)
      ? String(value)
      : JSON.stringify(value);
    const setOptions = opts?.ex ? { ex: opts.ex } : undefined;
    return c.set(key, normalized, setOptions as unknown as never);
  },
  async incr(key: string): Promise<number> {
    const c = ensureClient();
    if (!c) {
      const current = (memory[key] ?? 0) as number;
      const next = (current as number) + 1;
      memory[key] = next;
      return next;
    }
    return c.incr(key);
  },
  async expire(key: string, seconds: number) {
    const c = ensureClient();
    if (!c) {
      setTimeout(() => delete memory[key], seconds * 1000).unref?.();
      return;
    }
    return c.expire(key, seconds);
  },
};


