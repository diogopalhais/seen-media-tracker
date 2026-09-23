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

/** Optional capabilities of this deployment, so the web app can hide what is not configured. */
export const FeaturesSchema = z.object({
  /** IGDB credentials present: games can be searched, browsed and logged. */
  games: z.boolean(),
  /** Steam key and id present: play time syncs from the owner's Steam account. */
  steam: z.boolean(),
});
export type Features = z.infer<typeof FeaturesSchema>;

export const SessionResponseSchema = z.object({
  authenticated: z.literal(true),
  expiresAt: IsoTimestampSchema,
  features: FeaturesSchema,
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const SESSION_TTL_DAYS = 30;
