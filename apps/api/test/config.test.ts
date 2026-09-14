import { describe, expect, it } from 'vitest';
import { ConfigError, decodeOwnerHash, loadConfig } from '../src/config.js';

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
