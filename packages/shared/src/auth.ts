import { z } from 'zod';
import { IsoTimestampSchema } from './media.js';

export const LoginRequestSchema = z.object({
  password: z.string().min(1, 'Password is required').max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  expiresAt: IsoTimestampSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const SessionResponseSchema = z.object({
  authenticated: z.literal(true),
  expiresAt: IsoTimestampSchema,
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const SESSION_TTL_DAYS = 30;
