import type { ProductType, ProductPlatform, ProductStatus } from './enums.js';

// Forma de datos de un producto del catálogo; priceCents son céntimos enteros (invariante #5) y coverImageUrl es nullable.
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

// Entrada para un producto nuevo; el repositorio asigna id y timestamps.
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

// Campos que un admin puede editar; el `| undefined` explícito permite asignar campos DTO opcionales con exactOptionalPropertyTypes.
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
