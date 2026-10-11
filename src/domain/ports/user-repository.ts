import type { User, UserCreateInput } from '../model/index.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(input: UserCreateInput): Promise<User>;
}
