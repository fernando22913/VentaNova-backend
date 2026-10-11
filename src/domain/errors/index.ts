import { DomainError } from './domain-error.js';

// El payload o la entrada de dominio no pasó la validación → 422.
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 422;
}

// El recurso solicitado no existe → 404.
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
}

// Se violó una regla de unicidad/invariante (p. ej. email ya usado) → 409.
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly httpStatus = 409;
}

// Autenticación requerida / credenciales rechazadas → 401.
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

// Autenticado pero sin permiso para esta acción → 403.
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
}

// Rechazo de la pasarela simulada; se usa internamente para abortar una transacción, nunca como forma HTTP.
export class PaymentDeclinedError extends DomainError {
  readonly code = 'PAYMENT_DECLINED';
  readonly httpStatus = 402;
}

export { DomainError } from './domain-error.js';
