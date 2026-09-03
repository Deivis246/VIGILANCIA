export function isTrustedSameOriginRequest(input: {
  origin?: string;
  host?: string;
  forwardedHost?: string;
  forwardedProto?: string;
  protocol: string;
  secFetchSite?: string;
}) {
  if (!input.origin) return false;
  if (input.secFetchSite && input.secFetchSite !== "same-origin" && input.secFetchSite !== "same-site") {
    return false;
  }
  const host = (input.forwardedHost || input.host || "").split(",")[0]?.trim();
  const protocol = (input.forwardedProto || input.protocol).split(",")[0]?.trim();
  if (!host || !protocol) return false;
  try {
    return new URL(input.origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

export class SlidingWindowRateLimiter {
  private readonly events = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  take(key: string, now = Date.now()) {
    const threshold = now - this.windowMs;
    const recent = (this.events.get(key) ?? []).filter((timestamp) => timestamp > threshold);
    if (recent.length >= this.maxRequests) {
      const retryAfterMs = Math.max(1_000, recent[0]! + this.windowMs - now);
      this.events.set(key, recent);
      return { allowed: false as const, retryAfterSeconds: Math.ceil(retryAfterMs / 1_000) };
    }
    recent.push(now);
    this.events.set(key, recent);
    return { allowed: true as const, retryAfterSeconds: 0 };
  }
}