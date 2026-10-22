// Fixed-window per-key limiter, kept on globalThis so HMR doesn't reset it.
const g = globalThis as unknown as { __rl?: Map<string, { start: number; n: number }> };
const hits = (g.__rl ??= new Map());

export function rateLimit(
  key: string,
  max: number,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.start >= windowMs) {
    hits.set(key, { start: now, n: 1 });
    return { ok: true };
  }
  if (h.n >= max) return { ok: false, retryAfterSec: Math.ceil((h.start + windowMs - now) / 1000) };
  h.n++;
  return { ok: true };
}
