import pino, { type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string, pretty = false): Logger {
  return pino({
    level,
    base: { service: 'seen-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['req.headers.authorization'],
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}
