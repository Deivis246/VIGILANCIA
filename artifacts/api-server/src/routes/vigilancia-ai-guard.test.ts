import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("./vigilancia-ai-guard.ts", import.meta.url).href;
const guardModule = await import(moduleUrl);
const { isTrustedSameOriginRequest, SlidingWindowRateLimiter } = guardModule;

test("solo acepta solicitudes del mismo origen", () => {
  assert.equal(isTrustedSameOriginRequest({
    origin: "https://hospital.example",
    host: "internal:8080",
    forwardedHost: "hospital.example",
    forwardedProto: "https",
    protocol: "http",
    secFetchSite: "same-origin",
  }), true);
  assert.equal(isTrustedSameOriginRequest({
    origin: "https://attacker.example",
    forwardedHost: "hospital.example",
    forwardedProto: "https",
    protocol: "http",
    secFetchSite: "cross-site",
  }), false);
  assert.equal(isTrustedSameOriginRequest({
    forwardedHost: "hospital.example",
    forwardedProto: "https",
    protocol: "http",
  }), false);
});

test("bloquea solicitudes repetidas hasta que termine la ventana", () => {
  const limiter = new SlidingWindowRateLimiter(2, 60_000);
  assert.equal(limiter.take("cliente", 1_000).allowed, true);
  assert.equal(limiter.take("cliente", 2_000).allowed, true);
  const blocked = limiter.take("cliente", 3_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(limiter.take("cliente", 62_001).allowed, true);
});