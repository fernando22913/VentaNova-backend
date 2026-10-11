import { z } from 'zod';
import type { ZodError, ZodType } from 'zod';

import { DomainError } from '../../domain/errors/index.js';

// Error de validación de límite (blueprint §7): fallo de entrada zod, la respuesta incluye detalles por campo.
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

// Parsea entrada desconocida con un esquema zod; lanza RequestValidationError con detalles por campo si falla.
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error);
  }
  return result.data;
}

// Valida el parámetro `:id` de una ruta como UUID, devolviendo un 422 limpio en vez de un 500.
export function parseUuidParam(value: unknown, field = 'id'): string {
  return parseOrThrow(z.string().uuid({ message: `Invalid ${field}` }), value);
}
