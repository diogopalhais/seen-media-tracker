import type { SessionRow } from './db/schema.js';
import type { Logger } from './logger.js';

export type AppEnv = {
  Variables: {
    requestId: string;
    logger: Logger;
    clientIp: string;
    session: SessionRow;
  };
};
