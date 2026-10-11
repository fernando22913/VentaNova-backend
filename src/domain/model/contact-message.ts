import type { ContactStatus } from './enums.js';

// Contacto recibido por el endpoint público; se guarda para un operador, no se envía email.
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  // Cuerpo de la respuesta del operador: null hasta que se responda el mensaje.
  reply: string | null;
  repliedAt: Date | null;
  // Id del operador (WORKER/ADMIN) que respondió.
  repliedBy: string | null;
  createdAt: Date;
}

// Payload validado en el límite para crear un mensaje; el esquema zod de la ruta recorta y acota los campos.
export interface ContactMessageCreateInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Respuesta del operador registrada desde la bandeja de contactos.
export interface ContactMessageReplyInput {
  reply: string;
  repliedBy: string;
}
