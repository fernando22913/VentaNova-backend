/**
 * Base class for all domain-level errors.
 *
 * Domain errors carry an HTTP status and a stable machine-readable code so
 * the Express error middleware can map them to responses without the use
 * cases ever talking to HTTP. Adapters may wrap infrastructure failures in
 * these, but the types are defined here — in the core — because they are part
 * of the domain language ("show me the 409, not the stack trace").
 */
export abstract class DomainError extends Error {
  /** Stable machine-readable code, e.g. `CONFLICT`. */
  abstract readonly code: string;
  /** HTTP status the middleware should respond with. */
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}
