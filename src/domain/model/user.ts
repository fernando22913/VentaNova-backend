import type { UserRole } from './enums.js';

export interface User {
  id: string;
  email: string;
  name: string;
  // hash argon2id — nunca sale del núcleo hacia respuestas/DTOs.
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserCreateInput {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
}
