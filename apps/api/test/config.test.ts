import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  decodeOwnerHash,
  igdbConfig,
  loadConfig,
  steamConfig,
} from '../src/config.js';

const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$qdlOOXR7WGVr72b/YJytDA$H7EcWVpDXrki5ak/9TA8WCpft9jS40jYUrDaqeEC7f8';
const base = {
  DATABASE_URL: 'postgres://seen:seen@db:5432/seen',
  TMDB_API_TOKEN: 'token',
  CORS_ORIGINS: 'https://seen.example.com',
};

describe('OWNER_PASSWORD_HASH', () => {
  it('accepts the raw PHC string', () => {
    expect(loadConfig({ ...base, OWNER_PASSWORD_HASH: HASH }).OWNER_PASSWORD_HASH).toBe(HASH);
  });

  it('accepts the base64 form and decodes it', () => {
    const b64 = Buffer.from(HASH, 'utf8').toString('base64');
    expect(loadConfig({ ...base, OWNER_PASSWORD_HASH: b64 }).OWNER_PASSWORD_HASH).toBe(HASH);
    expect(decodeOwnerHash(`  ${b64}\n`)).toBe(HASH);
  });

  it('rejects a hash mangled by $ interpolation with a helpful message', () => {
    expect(() => loadConfig({ ...base, OWNER_PASSWORD_HASH: 'v=19,t=2,p=1' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, OWNER_PASSWORD_HASH: '=19=19456,t=2,p=1' })).toThrow(
      /base64 form/,
    );
  });

  it('fails fast when required variables are missing', () => {
    expect(() => loadConfig({ OWNER_PASSWORD_HASH: HASH })).toThrow(/DATABASE_URL/);
  });
});

describe('loadConfig optional integrations', () => {
  const full = { ...base, OWNER_PASSWORD_HASH: HASH };

  it('treats empty strings from compose defaults as unset', () => {
    const config = loadConfig({
      ...full,
      IGDB_CLIENT_ID: '',
      IGDB_CLIENT_SECRET: '',
      STEAM_API_KEY: '',
      STEAM_ID: '',
    });
    expect(igdbConfig(config)).toBeNull();
    expect(steamConfig(config)).toBeNull();
  });

  it('rejects half-configured pairs and a malformed Steam id', () => {
    expect(() => loadConfig({ ...full, IGDB_CLIENT_ID: 'a' })).toThrow(/IGDB_CLIENT_SECRET/);
    expect(() => loadConfig({ ...full, STEAM_API_KEY: 'k' })).toThrow(/STEAM_ID/);
    expect(() => loadConfig({ ...full, STEAM_API_KEY: 'k', STEAM_ID: 'wabisabi' })).toThrow(
      /17-digit/,
    );
    const ok = loadConfig({ ...full, STEAM_API_KEY: 'k', STEAM_ID: '76561197991753462' });
    expect(steamConfig(ok)).toEqual({ apiKey: 'k', steamId: '76561197991753462' });
  });
});
