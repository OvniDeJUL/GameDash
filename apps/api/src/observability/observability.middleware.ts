import { randomUUID } from "crypto";
import { ObservabilityService } from "./observability.service";

interface ObservedRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
}

interface ObservedResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: "finish", listener: () => void): void;
}

type NextFunction = () => void;
type ObservabilityRequestHandler = (
  request: ObservedRequest,
  response: ObservedResponse,
  next: NextFunction
) => void;

export function createObservabilityMiddleware(
  observabilityService: ObservabilityService
): ObservabilityRequestHandler {
  return (request, response, next) => {
    const startedAt = Date.now();
    const requestId = resolveRequestId(request.headers["x-request-id"]);
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    response.once("finish", () => {
      observabilityService.recordRequest({
        method: request.method ?? "UNKNOWN",
        path: request.originalUrl ?? request.url ?? "unknown",
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        requestId,
        occurredAt: new Date().toISOString()
      });
    });

    next();
  };
}

function resolveRequestId(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.trim().length > 0 ? value.trim() : randomUUID();
}
