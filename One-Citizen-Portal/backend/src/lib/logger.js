// Structured JSON logger (Architecture §6.3). PII is redacted; sensitive fields never logged.
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.otp',
      'req.body.code',
      'req.body.instrument',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
  base: undefined, // omit pid/hostname noise in the reference build
  formatters: {
    level: (label) => ({ level: label }),
  },
});
