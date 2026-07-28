// In-process fixed-window rate limiter. Good enough for this deployment
// shape (one admin container, no replicas — see docker-compose.prod.yml) but
// would silently under/over-count with multiple instances since the bucket
// map isn't shared; move to a shared store (Redis) if admin is ever scaled
// out. Runs on the Edge runtime (middleware.ts), so no Node-only APIs here.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Crude guard against unbounded memory growth from spoofed/rotating IPs —
// a real deployment would evict lazily by resetAt, but a hard cap is simpler
// and this map is only ever a few hundred entries under normal use.
const MAX_TRACKED_KEYS = 5000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
