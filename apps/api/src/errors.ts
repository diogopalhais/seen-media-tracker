import {
  API_ERROR_STATUS,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiErrorDetail,
} from '@seen/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface ZodIssueSource {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiErrorDetail[],
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = API_ERROR_STATUS[code] as ContentfulStatusCode;
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && this.details.length > 0 ? { details: this.details } : {}),
      },
    };
  }

  static validation(details: ApiErrorDetail[], message = 'Request validation failed'): ApiError {
    return new ApiError('validation_error', message, details);
  }

  static fromZod(error: ZodIssueSource, prefix = ''): ApiError {
    return ApiError.validation(
      error.issues.map((issue) => ({
        path: [prefix, ...issue.path.map(String)].filter(Boolean).join('.'),
        message: issue.message,
      })),
    );
  }

  static unauthorized(): ApiError {
    return new ApiError('unauthorized', 'Authentication required', undefined, {
      'WWW-Authenticate': 'Bearer',
    });
  }

  static notFound(what = 'Resource'): ApiError {
    return new ApiError('not_found', `${what} not found`);
  }
}

export function sendError(c: Context, err: ApiError): Response {
  for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
  return c.json(err.toBody(), err.status);
}
