import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';
import { ApiError } from './errors.js';

/** zod-validator wrapper that converts failures into the standard error shape. */
export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) throw ApiError.fromZod(result.error);
  });
}
