import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number().int().min(0),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
