import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'validation_error',
  'unauthorized',
  'invalid_credentials',
  'not_found',
  'method_not_allowed',
  'payload_too_large',
  'rate_limited',
  'internal_error',
  'upstream_unavailable',
  'push_disabled',
  'steam_disabled',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    details: z.array(ApiErrorDetailSchema).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  invalid_credentials: 401,
  not_found: 404,
  method_not_allowed: 405,
  payload_too_large: 413,
  rate_limited: 429,
  internal_error: 500,
  upstream_unavailable: 502,
  push_disabled: 503,
  steam_disabled: 503,
};
