import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { randomUUID } from "crypto";
import type { ErrorResponse } from "@gamedash/contracts";
import { ObservabilityService } from "./observability.service";

interface ObservedRequest {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
}

interface ObservedResponse {
  status(code: number): {
    json(body: ErrorResponse): void;
  };
}

interface HttpExceptionBody {
  error?: string;
  message?: string | string[];
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  constructor(private readonly observabilityService: ObservabilityService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<ObservedRequest>();
    const response = context.getResponse<ObservedResponse>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = this.getExceptionBody(exception);
    const message = this.resolveMessage(exception, exceptionBody);
    const code = this.resolveCode(statusCode, exceptionBody);
    const requestId = request.requestId ?? this.resolveHeader(request.headers["x-request-id"]) ?? randomUUID();
    const timestamp = new Date().toISOString();
    const path = request.originalUrl ?? request.url ?? "unknown";
    const method = request.method ?? "UNKNOWN";

    this.observabilityService.recordError({
      method,
      path,
      statusCode,
      code,
      message,
      requestId,
      occurredAt: timestamp
    });

    response.status(statusCode).json({
      error: {
        code,
        message,
        statusCode,
        timestamp,
        path,
        requestId
      }
    });
  }

  private getExceptionBody(exception: unknown): HttpExceptionBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    if (typeof response === "string") {
      return { message: response };
    }
    if (response && typeof response === "object") {
      return response as HttpExceptionBody;
    }

    return {};
  }

  private resolveMessage(exception: unknown, body: HttpExceptionBody): string {
    if (Array.isArray(body.message)) {
      return body.message.join("; ");
    }
    if (typeof body.message === "string" && body.message.trim().length > 0) {
      return body.message;
    }
    if (exception instanceof Error && exception.message.trim().length > 0) {
      return exception.message;
    }

    return "Unexpected server error.";
  }

  private resolveCode(statusCode: number, body: HttpExceptionBody): string {
    if (typeof body.error === "string" && body.error.trim().length > 0) {
      return toSnakeCase(body.error);
    }

    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return "unauthorized";
    }
    if (statusCode === HttpStatus.FORBIDDEN) {
      return "forbidden";
    }
    if (statusCode === HttpStatus.NOT_FOUND) {
      return "not_found";
    }
    if (statusCode === HttpStatus.BAD_REQUEST) {
      return "bad_request";
    }

    return statusCode >= 500 ? "internal_error" : "request_error";
  }

  private resolveHeader(header: string | string[] | undefined): string | undefined {
    const value = Array.isArray(header) ? header[0] : header;
    return value && value.trim().length > 0 ? value.trim() : undefined;
  }
}

function toSnakeCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
