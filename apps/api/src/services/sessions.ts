import { createHash, randomBytes } from 'node:crypto';
import { SESSION_TTL_DAYS } from '@seen/shared';
import { and, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { type SessionRow, sessions } from '../db/schema.js';

const LAST_USED_REFRESH_MS = 60_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class SessionService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userAgent: string | null): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const created = this.now();
    const expiresAt = new Date(created.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.db.insert(sessions).values({
      tokenHash: hashToken(token),
      createdAt: created,
      expiresAt,
      lastUsedAt: created,
      userAgent,
    });
    return { token, expiresAt };
  }

  /** Returns the live session for a presented token, or null for unknown/expired/revoked tokens. */
  async resolve(token: string): Promise<SessionRow | null> {
    const at = this.now();
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, at)))
      .limit(1);
    if (!row) return null;
    if (at.getTime() - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS) {
      await this.db.update(sessions).set({ lastUsedAt: at }).where(eq(sessions.id, row.id));
    }
    return row;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }
}
