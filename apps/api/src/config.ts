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

/**
 * Accepts the PHC string (`$argon2id$…`) or its base64 encoding. The base64 form exists because
 * `$` is interpolated by Docker Compose, Coolify and most shells, silently corrupting the hash.
 */
export function decodeOwnerHash(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('$argon2id$')) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    if (decoded.startsWith('$argon2id$')) return decoded;
  } catch {
    // not base64
  }
  return null;
}

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
    .transform((v, ctx) => {
      const decoded = decodeOwnerHash(v);
      if (!decoded) {
        ctx.addIssue({
          code: 'custom',
          message:
            'OWNER_PASSWORD_HASH must be an argon2id hash. Docker Compose and Coolify interpolate `$` in values, which mangles the `$argon2id$…` form: paste the base64 form printed by `pnpm --filter @seen/api hash-password` instead (or escape every `$` as `$$`).',
        });
        return z.NEVER;
      }
      return decoded;
    }),
  TMDB_API_TOKEN: z.string().min(1, 'TMDB_API_TOKEN is required'),
  TMDB_LANGUAGE: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'TMDB_LANGUAGE must look like en-US')
    .default('en-US'),
  /** IGDB via Twitch OAuth; both or neither. Without them games are simply not offered. */
  IGDB_CLIENT_ID: z.string().trim().min(1).optional(),
  IGDB_CLIENT_SECRET: z.string().trim().min(1).optional(),
  /** Steam Web API key and the owner's SteamID64; both or neither. */
  STEAM_API_KEY: z.string().trim().min(1).optional(),
  STEAM_ID: z
    .string()
    .trim()
    .regex(/^\d{17}$/, 'STEAM_ID must be the 17-digit SteamID64')
    .optional(),
  CORS_ORIGINS: originList,
  TRUST_PROXY: booleanFlag,
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  // Web Push is optional: leave all three unset to run without notifications.
  VAPID_PUBLIC_KEY: z.string().trim().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().trim().min(1).optional(),
  VAPID_SUBJECT: z
    .string()
    .trim()
    .regex(/^(mailto:.+|https:\/\/.+)$/, 'VAPID_SUBJECT must be a mailto: address or an https URL')
    .optional(),
});

export type Config = z.infer<typeof EnvSchema>;

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** The VAPID trio, or null when push is not configured. Partial configuration is rejected by `loadConfig`. */
export function vapidConfig(
  config: Pick<Config, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'>,
): VapidConfig | null {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY || !config.VAPID_SUBJECT) return null;
  return {
    publicKey: config.VAPID_PUBLIC_KEY,
    privateKey: config.VAPID_PRIVATE_KEY,
    subject: config.VAPID_SUBJECT,
  };
}

export interface IgdbConfig {
  clientId: string;
  clientSecret: string;
}

/** IGDB credentials, or null when games are not configured. Partial configuration is rejected by `loadConfig`. */
export function igdbConfig(
  config: Pick<Config, 'IGDB_CLIENT_ID' | 'IGDB_CLIENT_SECRET'>,
): IgdbConfig | null {
  if (!config.IGDB_CLIENT_ID || !config.IGDB_CLIENT_SECRET) return null;
  return { clientId: config.IGDB_CLIENT_ID, clientSecret: config.IGDB_CLIENT_SECRET };
}

export interface SteamConfig {
  apiKey: string;
  steamId: string;
}

/** Steam credentials, or null when the Steam sync is not configured. */
export function steamConfig(
  config: Pick<Config, 'STEAM_API_KEY' | 'STEAM_ID'>,
): SteamConfig | null {
  if (!config.STEAM_API_KEY || !config.STEAM_ID) return null;
  return { apiKey: config.STEAM_API_KEY, steamId: config.STEAM_ID };
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Compose files pass unset optionals as empty strings (`${VAR:-}`); treat those as absent.
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`),
    );
  }
  const vapid = [
    parsed.data.VAPID_PUBLIC_KEY,
    parsed.data.VAPID_PRIVATE_KEY,
    parsed.data.VAPID_SUBJECT,
  ];
  const setCount = vapid.filter(Boolean).length;
  if (setCount > 0 && setCount < 3) {
    throw new ConfigError([
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set together (generate keys with `pnpm --filter @seen/api vapid`) or all left unset to disable push',
    ]);
  }
  if (Boolean(parsed.data.IGDB_CLIENT_ID) !== Boolean(parsed.data.IGDB_CLIENT_SECRET)) {
    throw new ConfigError([
      'IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set together or both left unset to disable games',
    ]);
  }
  if (Boolean(parsed.data.STEAM_API_KEY) !== Boolean(parsed.data.STEAM_ID)) {
    throw new ConfigError([
      'STEAM_API_KEY and STEAM_ID must be set together or both left unset to disable the Steam sync',
    ]);
  }
  return parsed.data;
}
