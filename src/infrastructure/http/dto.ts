import type { User } from '../../domain/model/user.js';
import type { Product } from '../../domain/model/product.js';
import type { Category } from '../../domain/model/category.js';
import type { Order } from '../../domain/model/order.js';
import type { Entitlement } from '../../domain/model/entitlement.js';
import type { TokenPair } from '../../application/auth/issue-token-pair.js';

/**
 * Response DTOs. These are the only shapes the API ever exposes — the domain
 * entities are deliberately never serialized directly (no `passwordHash`,
 * for example). The frontend mirrors these in `core/models`.
 */

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  createdAt: Date;
}

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: Product['type'];
  platform: Product['platform'];
  categoryId: string;
  priceCents: number;
  coverImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Public product detail. Deliberately does NOT include `assetUrl`: the
 * downloadable asset is a paid entitlement and is only ever revealed through
 * the authenticated `/library` endpoint. `PublicProductDetail` (with the asset
 * URL) is reserved for that entitlement-scoped shape.
 */
export interface PublicProductView extends PublicProduct {
  description: string;
}

/** Entitlement-scoped product shape: adds the gated download URL. */
export interface PublicProductDetail extends PublicProductView {
  assetUrl: string;
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
}

export function toUserDto(user: User): PublicUser {
  // Explicitly select fields — an object spread would be a future leak vector
  // if a new sensitive field were added to the entity.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/**
 * Authentication response envelope for register/login/refresh. Carries the
 * access token, the raw refresh token (the client stores it; the server only
 * keeps its hash) and the access-token lifetime. The refresh-token hash is
 * never included.
 */
export interface AuthResponse {
  user: PublicUser;
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export function toAuthResponse(user: User, tokens: TokenPair): AuthResponse {
  return {
    user: toUserDto(user),
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: tokens.tokenType,
    expires_in: tokens.expiresIn,
  };
}

export function toPublicProduct(product: Product): PublicProduct {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    summary: product.summary,
    type: product.type,
    platform: product.platform,
    categoryId: product.categoryId,
    priceCents: product.priceCents,
    coverImageUrl: product.coverImageUrl,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/** Public detail mapper — never leaks the gated `assetUrl`. */
export function toPublicProductView(product: Product): PublicProductView {
  return {
    ...toPublicProduct(product),
    description: product.description,
  };
}

/** Entitlement-scoped mapper — used only by the authenticated library. */
export function toPublicProductDetail(product: Product): PublicProductDetail {
  return {
    ...toPublicProductView(product),
    assetUrl: product.assetUrl,
  };
}

/** Admin product shape — the public detail plus the lifecycle status. */
export interface AdminProductDetail extends PublicProductDetail {
  status: Product['status'];
}

export function toAdminProductDetail(product: Product): AdminProductDetail {
  return { ...toPublicProductDetail(product), status: product.status };
}

export function toCategoryDto(category: Category): PublicCategory {
  return category;
}

export interface PublicOrderItem {
  productId: string;
  titleSnapshot: string;
  unitPriceCents: number;
  quantity: number;
}

export interface PublicOrder {
  id: string;
  status: Order['status'];
  totalCents: number;
  createdAt: Date;
  paidAt: Date | null;
  items: PublicOrderItem[];
}

export interface AdminOrder extends PublicOrder {
  userId: string;
}

export function toAdminOrderDto(order: Order): AdminOrder {
  return { ...toOrderDto(order), userId: order.userId };
}

export function toOrderDto(order: Order): PublicOrder {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    items: order.items.map((item) => ({
      productId: item.productId,
      titleSnapshot: item.titleSnapshot,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
  };
}

export interface PublicPayResult {
  order: PublicOrder;
  entitlements: { id: string; licenseKey: string; productId: string; grantedAt: Date }[];
}

export function toPayResult(order: Order, entitlements: Entitlement[]): PublicPayResult {
  return {
    order: toOrderDto(order),
    entitlements: entitlements.map((grant) => ({
      id: grant.id,
      licenseKey: grant.licenseKey,
      productId: grant.productId,
      grantedAt: grant.grantedAt,
    })),
  };
}

export interface PublicLibraryItem {
  entitlementId: string;
  licenseKey: string;
  grantedAt: Date;
  product: PublicProductDetail;
}

export function toLibraryItemDto(entitlement: Entitlement, product: Product): PublicLibraryItem {
  return {
    entitlementId: entitlement.id,
    licenseKey: entitlement.licenseKey,
    grantedAt: entitlement.grantedAt,
    product: toPublicProductDetail(product),
  };
}
