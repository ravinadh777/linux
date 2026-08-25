// Per-request structured logging (method, route, status, latency, actor) bound to requestId.
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger.js';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id, // set by requestId middleware
  customProps: (req) => ({
    actor: req.auth?.sub,
    role: req.auth?.roles,
    consumerId: req.auth?.consumerId,
  }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
