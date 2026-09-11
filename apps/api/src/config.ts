import { z } from 'zod';

const booleanFlag = z
  .enum(['0', '1', 'true', 'false'])
  .default('0')
  .transform((v) => v === '1' || v === 'true');

const originList = z
  .string()
  .min(1, 'CORS_ORIGINS must list at least one origin')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.url({ error: 'CORS_ORIGINS entries must be full origins like https://seen.example.com' }),
      )
      .min(1),
  )
  .transform((origins) => origins.map((o) => new URL(o).origin));

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (v) => /^postgres(ql)?:\/\//.test(v),
      'DATABASE_URL must be a postgres:// connection URL',
    ),
  OWNER_PASSWORD_HASH: z
    .string()
    .min(
      1,
      'OWNER_PASSWORD_HASH is required (generate it with `pnpm --filter @seen/api hash-password`)',
    )
    .refine((v) => v.startsWith('$argon2id$'), 'OWNER_PASSWORD_HASH must be an argon2id hash'),
  TMDB_API_TOKEN: z.string().min(1, 'TMDB_API_TOKEN is required'),
  TMDB_LANGUAGE: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'TMDB_LANGUAGE must look like en-US')
    .default('en-US'),
  CORS_ORIGINS: originList,
  TRUST_PROXY: booleanFlag,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
});

export type Config = z.infer<typeof EnvSchema>;

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`),
    );
  }
  return parsed.data;
}
