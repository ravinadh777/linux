// Central error handler → the single error contract (docs/API.md §2/§3).
// AppError subclasses map to their status/code; ZodError → 400; anything else → 500 (no leak).
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { ERROR_CODES } from '@onecitizen/shared/constants';
import { NotFoundError } from '../lib/errors.js';

/** 404 fallback — funnels unmatched routes through the same contract. */
export function notFound(req, _res, next) {
  next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = ERROR_CODES.INTERNAL;
  let message = 'Internal error';
  let details;
  let reasonCode;

  if (err instanceof ZodError) {
    status = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), issue: i.message }));
  } else if (err instanceof AppError) {
    status = err.httpStatus;
    code = err.code;
    reasonCode = err.reasonCode;
    if (err.expose) {
      message = err.message;
      details = err.details;
    } else {
      message = 'Internal error';
    }
  }

  // Always log the full error server-side (never sent to the client).
  if (req.log) {
    (status >= 500 ? req.log.error : req.log.warn).call(req.log, { err, code }, 'request_error');
  }

  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(reasonCode ? { reasonCode } : {}),
      requestId: req.id || null,
      timestamp: new Date().toISOString(),
    },
  });
}
