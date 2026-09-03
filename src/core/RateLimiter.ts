export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private userHits: Map<string, number[]> = new Map();
  private commandCooldowns: Map<string, number> = new Map(); // `${userId}:${command}` -> timestamp

  constructor(maxRequests = 10, windowMs = 5000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(userId: string): RateLimitResult {
    const now = Date.now();
    const hits = this.userHits.get(userId) || [];
    const validHits = hits.filter(time => now - time < this.windowMs);

    if (validHits.length >= this.maxRequests) {
      const oldest = validHits[0];
      const retryAfterMs = Math.max(0, this.windowMs - (now - oldest));
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
      };
    }

    validHits.push(now);
    this.userHits.set(userId, validHits);

    return {
      allowed: true,
      remaining: this.maxRequests - validHits.length,
      retryAfterMs: 0,
    };
  }

  checkCommandCooldown(userId: string, command: string, cooldownMs = 1000): { allowed: boolean; retryAfterMs: number } {
    if (cooldownMs <= 0) return { allowed: true, retryAfterMs: 0 };

    const key = `${userId}:${command}`;
    const now = Date.now();
    const last = this.commandCooldowns.get(key) || 0;
    const diff = now - last;

    if (diff < cooldownMs) {
      return {
        allowed: false,
        retryAfterMs: cooldownMs - diff,
      };
    }

    this.commandCooldowns.set(key, now);
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(userId?: string): void {
    if (userId) {
      this.userHits.delete(userId);
    } else {
      this.userHits.clear();
      this.commandCooldowns.clear();
    }
  }
}
