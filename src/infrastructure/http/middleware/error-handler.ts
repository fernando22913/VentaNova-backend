import type { NextFunction, Request, Response } from 'express';

import { DomainError } from '../../../domain/errors/index.js';
import { logger } from '../../logging/logger.js';
import { RequestValidationError } from '../validation.js';

interface BoundaryError {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

/**
 * Translate body-parser's own 4xx failures (malformed JSON, oversized body,
 * unsupported charset) into the standard envelope. Without this they would all
 * fall through to the generic 500 branch.
 */
function boundaryHttpError(error: unknown): { status: number; code: string; message: string } | null {
  if (typeof error !== 'object' || error === null) return null;
  const { type, status, statusCode } = error as BoundaryError;

  if (type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' };
  }
  if (type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  }
  if (type === 'charset.unsupported') {
    return { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported charset' };
  }

  const code = typeof status === 'number' ? status : statusCode;
  if (typeof code === 'number' && code >= 400 && code < 500) {
    return { status: code, code: 'BAD_REQUEST', message: 'Invalid request' };
  }
  return null;
}

/**
 * Pull a PostgreSQL SQLSTATE out of an error, following Drizzle's `cause`
 * chain, so database-enforced invariants surface as the right HTTP status
 * instead of a generic 500.
 */
function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (typeof current === 'object' && current !== null && 'code' in current) {
      const { code } = current as { code?: unknown };
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

const PG_CONSTRAINT_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  '23505': { status: 409, code: 'CONFLICT', message: 'Resource already exists' },
  '23503': { status: 409, code: 'CONFLICT', message: 'Related resource does not exist' },
  '23514': { status: 422, code: 'VALIDATION_ERROR', message: 'Value violates a data constraint' },
  '22P02': { status: 400, code: 'BAD_REQUEST', message: 'Malformed identifier' },
};

/**
 * Maps DomainErrors (and boundary validation errors) to the standard error
 * envelope `{ error: { code, message, details? } }` (blueprint §7). Controllers
 * never format errors — they throw typed errors and this middleware owns the
 * HTTP representation. Unknown errors return 500 without leaking internals.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof RequestValidationError) {
    res.status(error.httpStatus).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.httpStatus).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  const boundary = boundaryHttpError(error);
  if (boundary) {
    res.status(boundary.status).json({ error: { code: boundary.code, message: boundary.message } });
    return;
  }

  const pgCode = postgresErrorCode(error);
  const mapped = pgCode ? PG_CONSTRAINT_ERRORS[pgCode] : undefined;
  if (mapped) {
    res.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
    return;
  }

  logger.error({ err: error, requestId: req.id }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
  });
}
