import { randomUUID } from 'node:crypto';

import type { Database } from '../../../src/infrastructure/persistence/db.js';
import { DrizzleCategoryRepository } from '../../../src/infrastructure/persistence/repositories/category.repository.js';
import { DrizzleEntitlementRepository } from '../../../src/infrastructure/persistence/repositories/entitlement.repository.js';
import { DrizzleOrderRepository } from '../../../src/infrastructure/persistence/repositories/order.repository.js';
import { DrizzleProductRepository } from '../../../src/infrastructure/persistence/repositories/product.repository.js';
import { DrizzleRefreshTokenRepository } from '../../../src/infrastructure/persistence/repositories/refresh-token.repository.js';
import { DrizzleUserRepository } from '../../../src/infrastructure/persistence/repositories/user.repository.js';

import type { User } from '../../../src/domain/model/user.js';
import type { Category } from '../../../src/domain/model/category.js';
import type { Product } from '../../../src/domain/model/product.js';
import type { RefreshToken, RefreshTokenCreateInput } from '../../../src/domain/model/refresh-token.js';

export function repositories(db: Database) {
  return {
    users: new DrizzleUserRepository(db),
    products: new DrizzleProductRepository(db),
    categories: new DrizzleCategoryRepository(db),
    orders: new DrizzleOrderRepository(db),
    entitlements: new DrizzleEntitlementRepository(db),
    refreshTokens: new DrizzleRefreshTokenRepository(db),
  };
}

export type Repos = ReturnType<typeof repositories>;

export async function makeUser(repos: Repos, overrides: Partial<User> = {}): Promise<User> {
  return repos.users.create({
    email: overrides.email ?? `user-${randomId()}@bytemarket.dev`,
    name: overrides.name ?? 'Test User',
    passwordHash: overrides.passwordHash ?? 'argon2-test-hash-not-real',
    role: overrides.role ?? 'CUSTOMER',
  });
}

export async function makeCategory(
  repos: Repos,
  overrides: Partial<Category> = {},
): Promise<Category> {
  return repos.categories.create({
    slug: overrides.slug ?? `category-${randomId()}`,
    name: overrides.name ?? 'A Category',
  });
}

export async function makeProduct(
  repos: Repos,
  categoryId: string,
  overrides: Partial<Product> = {},
): Promise<Product> {
  return repos.products.create({
    slug: overrides.slug ?? `product-${randomId()}`,
    title: overrides.title ?? 'Test Product',
    summary: 'A test summary.',
    description: 'A longer test description.',
    type: overrides.type ?? 'GAME',
    platform: overrides.platform ?? 'CROSS',
    categoryId,
    priceCents: overrides.priceCents ?? 1999,
    status: overrides.status ?? 'PUBLISHED',
    coverImageUrl: overrides.coverImageUrl ?? null,
    assetUrl: overrides.assetUrl ?? `https://cdn.example.com/${overrides.slug ?? 'x'}.zip`,
  });
}

export async function makeRefreshToken(
  repos: Repos,
  userId: string,
  overrides: Partial<RefreshTokenCreateInput> = {},
): Promise<RefreshToken> {
  return repos.refreshTokens.create({
    userId,
    familyId: overrides.familyId ?? randomUUID(),
    tokenHash: overrides.tokenHash ?? `hash-${randomId()}`,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
