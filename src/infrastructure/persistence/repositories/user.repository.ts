import { eq } from 'drizzle-orm';

import type { User, UserCreateInput } from '../../../domain/model/user.js';
import type { UserRepository } from '../../../domain/ports/user-repository.js';
import type { Database } from '../db.js';
import { users } from '../schema.js';

/** Drizzle adapter for the UserRepository port. */
export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? rowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ? rowToUser(row) : null;
  }

  async create(input: UserCreateInput): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
      })
      .returning();
    if (!row) {
      throw new Error('Inserting a user returned no row');
    }
    return rowToUser(row);
  }
}

export function rowToUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: row.createdAt,
  };
}
