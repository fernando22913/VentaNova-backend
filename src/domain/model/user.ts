import type { UserRole } from './enums.js';

export interface User {
  id: string;
  email: string;
  name: string;
  /** argon2id hash — never leave the core in responses/DTOs. */
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
