import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;

export const tokenLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      analytics: true,
      prefix: "wilsons:token",
    })
  : null;

export async function enforceTokenRateLimit(token: string) {
  if (!tokenLimiter) return { remaining: Infinity };
  const { success, reset, remaining } = await tokenLimiter.limit(token);
  if (!success) {
    throw new Error(
      `Too many requests. Try again in ${Math.ceil((reset - Date.now()) / 1000)}s.`
    );
  }
  return { remaining };
}
