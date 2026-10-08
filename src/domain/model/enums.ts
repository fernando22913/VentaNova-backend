/**
 * Enumerations used across the domain.
 *
 * Each enum is a closed union type plus a readonly array of its values. The
 * arrays feed both runtime validation (zod) and the PostgreSQL `ENUM` types,
 * so the DB check constraints and the TypeScript types can never drift apart.
 */

export const PRODUCT_TYPES = ['GAME', 'SOFTWARE', 'DLC', 'ASSET'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_PLATFORMS = ['WINDOWS', 'MAC', 'LINUX', 'WEB', 'CROSS'] as const;
export type ProductPlatform = (typeof PRODUCT_PLATFORMS)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const USER_ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.includes(value as ProductType);
}

export function isProductPlatform(value: unknown): value is ProductPlatform {
  return PRODUCT_PLATFORMS.includes(value as ProductPlatform);
}

export function isProductStatus(value: unknown): value is ProductStatus {
  return PRODUCT_STATUSES.includes(value as ProductStatus);
}

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}
