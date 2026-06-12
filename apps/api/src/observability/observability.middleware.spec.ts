import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createObservabilityMiddleware } from "./observability.middleware";
import { ObservabilityService } from "./observability.service";

class ResponseStub extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
}

const service = new ObservabilityService();
const handler = createObservabilityMiddleware(service);
const response = new ResponseStub();
let nextCalled = false;

handler(
  {
    headers: {},
    method: "GET",
    originalUrl: "/api/v1/health"
  },
  response,
  () => {
    nextCalled = true;
  }
);
response.emit("finish");

const snapshot = service.getSnapshot();
assert.equal(nextCalled, true);
assert.equal(snapshot.requestCount, 1);
assert.equal(response.headers.has("x-request-id"), true);

console.log("observability middleware tests passed");
