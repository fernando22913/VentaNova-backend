import {
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
  ORDER_STATUSES,
  PRODUCT_PLATFORMS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  USER_ROLES,
} from '../../domain/model/enums.js';

/**
 * PostgreSQL `citext` type (no built-in support in this Drizzle version, so
 * declared via customType). Requires `CREATE EXTENSION citext`, emitted at the
 * top of the first migration. Case-insensitive email uniqueness without
 * application-side normalization.
 */
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

const productTypeEnum = pgEnum('product_type', [...PRODUCT_TYPES]);
const productPlatformEnum = pgEnum('product_platform', [...PRODUCT_PLATFORMS]);
const productStatusEnum = pgEnum('product_status', [...PRODUCT_STATUSES]);
const userRoleEnum = pgEnum('user_role', [...USER_ROLES]);
const orderStatusEnum = pgEnum('order_status', [...ORDER_STATUSES]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('CUSTOMER'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    description: text('description').notNull(),
    type: productTypeEnum('type').notNull(),
    platform: productPlatformEnum('platform').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    priceCents: integer('price_cents').notNull(),
    status: productStatusEnum('status').notNull().default('DRAFT'),
    coverImageUrl: text('cover_image_url'),
    assetUrl: text('asset_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index('products_status_idx').on(table.status),
    index('products_category_id_idx').on(table.categoryId),
    check('products_price_non_negative', sql`${table.priceCents} >= 0`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').notNull().default('PENDING'),
    totalCents: integer('total_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true, precision: 3 }),
  },
  (table) => [
    index('orders_user_created_idx').on(table.userId, table.createdAt),
    // Defense-in-depth: the application recomputes totals from DB prices, but
    // the database itself must reject a negative total if that ever regresses.
    check('orders_total_cents_non_negative', sql`${table.totalCents} >= 0`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    titleSnapshot: text('title_snapshot').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    uniqueIndex('order_items_order_product_unique').on(table.orderId, table.productId),
    check('order_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

export const entitlements = pgTable(
  'entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    licenseKey: text('license_key').notNull().unique(),
    grantedAt: timestamp('granted_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index('entitlements_user_id_idx').on(table.userId),
    index('entitlements_order_id_idx').on(table.orderId),
    uniqueIndex('entitlements_user_product_unique').on(table.userId, table.productId),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Rotation family: every token minted from one login session shares it.
    familyId: uuid('family_id').notNull(),
    // SHA-256 of the opaque token. The raw token is never stored.
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 3 }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, precision: 3 }),
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_family_id_idx').on(table.familyId),
  ],
);

export type CategoryRow = typeof categories.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type EntitlementRow = typeof entitlements.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
