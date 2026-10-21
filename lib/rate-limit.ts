type Entry = { count: number; resetAt: number };
const memory = new Map<string, Entry>();

/** Suitable for a single-process deployment; use a shared Redis limiter when horizontally scaled. */
export function enforceRateLimit(key: string, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new Error("Too many requests. Please try again shortly.");
  current.count += 1;
}
