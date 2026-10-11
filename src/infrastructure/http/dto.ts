import type { User } from '../../domain/model/user.js';
import type { Product } from '../../domain/model/product.js';
import type { Category } from '../../domain/model/category.js';
import type { Order } from '../../domain/model/order.js';
import type { Entitlement } from '../../domain/model/entitlement.js';
import type { ContactMessage } from '../../domain/model/contact-message.js';
import type { TrendReport } from '../../domain/model/trends.js';
import type { TokenPair } from '../../application/auth/issue-token-pair.js';

// DTOs de respuesta: únicos formatos que expone la API; las entidades de dominio nunca se serializan directamente.

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

// Detalle público de producto: omite a propósito `assetUrl`, expuesto solo vía `/library`.
export interface PublicProductView extends PublicProduct {
  description: string;
}

// Forma de producto con entitlement: añade la URL de descarga protegida.
export interface PublicProductDetail extends PublicProductView {
  assetUrl: string;
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
}

export function toUserDto(user: User): PublicUser {
  // Selecciona campos explícitamente: un spread podría filtrar nuevos campos sensibles de la entidad.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// Envoltorio de respuesta de auth para register/login/refresh: access + refresh token sin cifrar y su duración; nunca el hash.
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

// Mapper de detalle público: nunca filtra el `assetUrl` protegido.
export function toPublicProductView(product: Product): PublicProductView {
  return {
    ...toPublicProduct(product),
    description: product.description,
  };
}

// Mapper con entitlement: usado solo por la biblioteca autenticada.
export function toPublicProductDetail(product: Product): PublicProductDetail {
  return {
    ...toPublicProductView(product),
    assetUrl: product.assetUrl,
  };
}

// Forma de producto admin: el detalle público más el estado del ciclo de vida.
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

// Respuesta de envío de contacto: confirma que el mensaje se guardó; no existe transporte de email.
export interface PublicContactMessage {
  id: string;
  name: string;
  subject: string;
  message: string;
  createdAt: Date;
}

export function toContactMessageDto(message: ContactMessage): PublicContactMessage {
  return {
    id: message.id,
    name: message.name,
    subject: message.subject,
    message: message.message,
    createdAt: message.createdAt,
  };
}

// Forma de bandeja del personal: mensaje completo más campos de respuesta del operador, solo tras auth ADMIN/WORKER.
export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactMessage['status'];
  reply: string | null;
  repliedAt: Date | null;
  repliedBy: string | null;
  createdAt: Date;
}

export function toAdminContactMessageDto(message: ContactMessage): AdminContactMessage {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: message.status,
    reply: message.reply,
    repliedAt: message.repliedAt,
    repliedBy: message.repliedBy,
    createdAt: message.createdAt,
  };
}

// Respuesta de tendencias: copia superficial del informe agregado.
export function toTrendReportDto(report: TrendReport): TrendReport {
  return {
    totals: { ...report.totals },
    sales: report.sales.map((point) => ({ ...point })),
    bestSellers: report.bestSellers.map((seller) => ({ ...seller })),
  };
}
