import { z } from 'zod';
import type { ZodError, ZodType } from 'zod';

import { DomainError } from '../../domain/errors/index.js';

/**
 * Boundary validation error (blueprint §7): input failed a zod schema, so the
 * response includes field-level `details`. HTTP-only concern — the application
 * layer never sees raw request payloads.
 */
export class RequestValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 422;
  readonly details: { path: string; message: string }[];

  constructor(error: ZodError) {
    super('Validation failed');
    this.name = 'RequestValidationError';
    this.details = error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
  }
}

/** Parse unknown input with a zod schema, throwing RequestValidationError
 * with field details when it does not match. */
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error);
  }
  return result.data;
}

/**
 * Validate a route `:id` parameter as a UUID at the boundary. Without this a
 * malformed id reaches PostgreSQL's uuid cast and surfaces as a 500; rejected
 * here it is a clean 422.
 */
export function parseUuidParam(value: unknown, field = 'id'): string {
  return parseOrThrow(z.string().uuid({ message: `Invalid ${field}` }), value);
}
