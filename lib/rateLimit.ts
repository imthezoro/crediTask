import { redis } from './redis';

const FREE_LIMIT_PER_HOUR = 20;

export async function enforceRateLimit(userId: string) {
  const key = `rl:${userId}:${new Date().getUTCHours()}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60 * 60);
  }
  if (count > FREE_LIMIT_PER_HOUR) {
    throw new Error('Rate limit exceeded');
  }
}


