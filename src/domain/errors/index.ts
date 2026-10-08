import { DomainError } from './domain-error.js';

/** Request payload or domain input failed validation → 422. */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 422;
}

/** The requested resource does not exist → 404. */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
}

/** A uniqueness/invariant rule was violated (e.g. email taken) → 409. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly httpStatus = 409;
}

/** Authentication required / credentials rejected → 401. */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

/** Authenticated but not allowed to perform this action → 403. */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
}

/**
 * The simulated gateway declined the payment.
 *
 * Declined is surfaced as order data, not a transport error (blueprint §7),
 * so this error is used inside adapters/use-case internals where a decline
 * must abort the transaction — never as the HTTP response shape.
 */
export class PaymentDeclinedError extends DomainError {
  readonly code = 'PAYMENT_DECLINED';
  readonly httpStatus = 402;
}

export { DomainError } from './domain-error.js';
