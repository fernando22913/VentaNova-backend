// Clase base para errores de dominio con un estado HTTP y un código estable legible por máquina.
export abstract class DomainError extends Error {
  // Código estable legible por máquina, p. ej. `CONFLICT`.
  abstract readonly code: string;
  // Estado HTTP con el que debe responder el middleware.
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}
