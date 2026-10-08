import type { ProductType, ProductPlatform, ProductStatus } from './enums.js';

/**
 * A catalog product. Purely a data shape: the rules that decide whether a
 * product may be bought live in the application layer, so the persistence
 * adapter has a single, honest mapping target.
 *
 * `priceCents` is integer cents (domain invariant #5). `coverImageUrl` is
 * nullable because an admin may publish a product before uploading a cover.
 */
export interface Product {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: ProductType;
  platform: ProductPlatform;
  categoryId: string;
  priceCents: number;
  status: ProductStatus;
  coverImageUrl: string | null;
  assetUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for a fresh product; the repository assigns id and timestamps. */
export interface ProductCreateInput {
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: ProductType;
  platform: ProductPlatform;
  categoryId: string;
  priceCents: number;
  coverImageUrl: string | null;
  assetUrl: string;
  status: ProductStatus;
}

/** Fields an admin may edit. `status` is managed via its own transition.
 * Explicit `| undefined` keeps parsed optional DTO fields assignable under
 * `exactOptionalPropertyTypes`. */
export interface ProductUpdateInput {
  slug?: string | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  description?: string | undefined;
  type?: ProductType | undefined;
  platform?: ProductPlatform | undefined;
  categoryId?: string | undefined;
  priceCents?: number | undefined;
  coverImageUrl?: string | null | undefined;
  assetUrl?: string | undefined;
}
