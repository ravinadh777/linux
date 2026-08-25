// Application error taxonomy → maps to the standard error contract (docs/API.md §3).
// The central error middleware (story S0.2) translates these to HTTP responses.
import { ERROR_CODES } from '@onecitizen/shared/constants';

export class AppError extends Error {
  /**
   * @param {string} code    - one of ERROR_CODES
   * @param {number} httpStatus
   * @param {string} message
   * @param {object} [opts]   - { details?, reasonCode? }
   */
  constructor(code, httpStatus, message, opts = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = opts.details;
    this.reasonCode = opts.reasonCode;
    this.expose = true; // safe to show to the client
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(ERROR_CODES.VALIDATION_ERROR, 400, message, { details });
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(ERROR_CODES.UNAUTHENTICATED, 401, message);
  }
}
export class StepUpRequiredError extends AppError {
  constructor(message = 'Higher identity assurance required') {
    super(ERROR_CODES.STEP_UP_REQUIRED, 403, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Not permitted') {
    super(ERROR_CODES.FORBIDDEN, 403, message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(ERROR_CODES.NOT_FOUND, 404, message);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Version conflict', details) {
    super(ERROR_CODES.CONFLICT, 409, message, { details });
  }
}
export class DuplicateError extends AppError {
  constructor(message = 'Duplicate resource', details) {
    super(ERROR_CODES.DUPLICATE, 409, message, { details });
  }
}
export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violation', reasonCode, details) {
    super(ERROR_CODES.BUSINESS_RULE_VIOLATION, 422, message, { reasonCode, details });
  }
}
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(ERROR_CODES.RATE_LIMITED, 429, message);
  }
}
export class IntegrationUnavailableError extends AppError {
  constructor(message = 'Upstream integration unavailable') {
    super(ERROR_CODES.INTEGRATION_UNAVAILABLE, 503, message);
  }
}
export class InternalError extends AppError {
  constructor(message = 'Internal error') {
    super(ERROR_CODES.INTERNAL, 500, message);
    this.expose = false;
  }
}
