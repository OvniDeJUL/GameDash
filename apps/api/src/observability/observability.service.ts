import { Injectable } from "@nestjs/common";
import type { HealthResponse, ObservabilitySnapshotResponse } from "@gamedash/contracts";

interface RequestMetricInput {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
  occurredAt: string;
}

interface ErrorMetricInput {
  method: string;
  path: string;
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  occurredAt: string;
}

const MAX_DURATION_SAMPLES = 100;
const MAX_RECENT_ERRORS = 20;

@Injectable()
export class ObservabilityService {
  private readonly startedAt = new Date().toISOString();
  private requestCount = 0;
  private errorCount = 0;
  private criticalErrorCount = 0;
  private lastRequestAt?: string;
  private readonly durationsMs: number[] = [];
  private readonly recentErrors: ErrorMetricInput[] = [];

  recordRequest(input: RequestMetricInput): void {
    this.requestCount += 1;
    this.lastRequestAt = input.occurredAt;
    this.durationsMs.push(Math.max(0, Math.round(input.durationMs)));

    if (this.durationsMs.length > MAX_DURATION_SAMPLES) {
      this.durationsMs.shift();
    }
  }

  recordError(input: ErrorMetricInput): void {
    this.errorCount += 1;

    if (input.statusCode >= 500) {
      this.criticalErrorCount += 1;
    }

    this.recentErrors.unshift(input);
    if (this.recentErrors.length > MAX_RECENT_ERRORS) {
      this.recentErrors.pop();
    }
  }

  getHealth(): HealthResponse {
    const status = this.criticalErrorCount > 0 ? "degraded" : "ok";

    return {
      status,
      time: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      uptimeSeconds: this.calculateUptimeSeconds(),
      checks: [
        {
          name: "api",
          status: "ok",
          detail: "NestJS runtime is accepting requests."
        },
        {
          name: "contracts",
          status: "ok",
          detail: "OpenAPI and shared DTO validation are part of the mandatory suite."
        },
        {
          name: "storage",
          status: "ok",
          detail: "MVP runtime uses in-memory repositories with Prisma schema baseline."
        }
      ],
      observability: this.getSnapshot()
    };
  }

  getSnapshot(): ObservabilitySnapshotResponse {
    return {
      startedAt: this.startedAt,
      uptimeSeconds: this.calculateUptimeSeconds(),
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      criticalErrorCount: this.criticalErrorCount,
      lastRequestAt: this.lastRequestAt,
      p95DurationMs: this.calculateP95Duration(),
      recentErrors: this.recentErrors.map((error) => ({
        method: error.method,
        path: error.path,
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        requestId: error.requestId,
        occurredAt: error.occurredAt
      }))
    };
  }

  private calculateUptimeSeconds(): number {
    return Math.max(0, Math.floor((Date.now() - Date.parse(this.startedAt)) / 1000));
  }

  private calculateP95Duration(): number {
    if (this.durationsMs.length === 0) {
      return 0;
    }

    const sorted = [...this.durationsMs].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return sorted[index] ?? 0;
  }
}
