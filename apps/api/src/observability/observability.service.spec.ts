import assert from "node:assert/strict";
import { ObservabilityService } from "./observability.service";

const service = new ObservabilityService();

const firstRequestAt = new Date().toISOString();
service.recordRequest({
  method: "GET",
  path: "/api/v1/health",
  statusCode: 200,
  durationMs: 12,
  requestId: "req_healthy",
  occurredAt: firstRequestAt
});
service.recordRequest({
  method: "POST",
  path: "/api/v1/auth/login",
  statusCode: 401,
  durationMs: 28,
  requestId: "req_unauthorized",
  occurredAt: new Date().toISOString()
});
service.recordError({
  method: "POST",
  path: "/api/v1/auth/login",
  statusCode: 401,
  code: "unauthorized",
  message: "Invalid email or password.",
  requestId: "req_unauthorized",
  occurredAt: new Date().toISOString()
});

const snapshot = service.getSnapshot();
assert.equal(snapshot.requestCount, 2);
assert.equal(snapshot.errorCount, 1);
assert.equal(snapshot.criticalErrorCount, 0);
assert.equal(snapshot.p95DurationMs, 28);
assert.equal(snapshot.recentErrors[0]?.code, "unauthorized");

const health = service.getHealth();
assert.equal(health.status, "ok");
assert.equal(health.observability.requestCount, 2);
assert.ok(health.checks.some((check) => check.name === "api"));

service.recordError({
  method: "GET",
  path: "/api/v1/fault",
  statusCode: 500,
  code: "internal_error",
  message: "Unexpected server error.",
  requestId: "req_fault",
  occurredAt: new Date().toISOString()
});

assert.equal(service.getHealth().status, "degraded");

console.log("observability service tests passed");
