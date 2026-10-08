import { Router } from 'express';
import { z } from 'zod';

import { PRODUCT_PLATFORMS, PRODUCT_STATUSES, PRODUCT_TYPES } from '../../../domain/model/enums.js';
import type { AppContainer } from '../../../container.js';
import { parseOrThrow, parseUuidParam } from '../validation.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { toAdminOrderDto, toAdminProductDetail } from '../dto.js';

const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'title'] as const;

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  platform: z.enum([...PRODUCT_PLATFORMS]).optional(),
  status: z.enum([...PRODUCT_STATUSES]).optional(),
  sort: z.enum([...PRODUCT_SORTS]).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

export const baseProductSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase-kebab'),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000),
  type: z.enum([...PRODUCT_TYPES]),
  platform: z.enum([...PRODUCT_PLATFORMS]),
  categoryId: z.string().uuid(),
  priceCents: z.coerce.number().int().min(0).max(99_999_999),
  coverImageUrl: z
    .string()
    .url()
    .max(500)
    .nullish()
    .transform((value) => value ?? null),
  assetUrl: z.string().url().max(500),
  status: z.enum(['DRAFT', 'PUBLISHED']),
});

export const updateProductSchema = baseProductSchema.omit({ status: true }).partial();

export const statusSchema = z.object({ status: z.enum([...PRODUCT_STATUSES]) });

export type ListProductsQuery = z.infer<typeof listQuerySchema>;
export type CreateProductBody = z.infer<typeof baseProductSchema>;
export type UpdateProductBody = z.infer<typeof updateProductSchema>;
export type ChangeStatusBody = z.infer<typeof statusSchema>;

export function createAdminRouter(container: AppContainer): Router {
  const router = Router();
  router.use(requireAuth(container.tokenService), requireAdmin());

  // --- Products -------------------------------------------------------------
  router.get('/products', async (req, res) => {
    const query = parseOrThrow(listQuerySchema, req.query);
    const result = await container.useCases.listProductsForAdmin.execute({
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
      ...(query.search ? { search: query.search } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    res.json({
      items: result.items.map(toAdminProductDetail),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  });

  router.post('/products', async (req, res) => {
    const input = parseOrThrow(baseProductSchema, req.body);
    const product = await container.useCases.createProduct.execute(input);
    res.status(201).json(toAdminProductDetail(product));
  });

  router.patch('/products/:id', async (req, res) => {
    const productId = parseUuidParam(req.params.id, 'product id');
    const changes = parseOrThrow(updateProductSchema, req.body);
    const product = await container.useCases.updateProduct.execute(productId, changes);
    res.json(toAdminProductDetail(product));
  });

  router.patch('/products/:id/status', async (req, res) => {
    const productId = parseUuidParam(req.params.id, 'product id');
    const { status } = parseOrThrow(statusSchema, req.body);
    const product = await container.useCases.changeProductStatus.execute(productId, status);
    res.json(toAdminProductDetail(product));
  });

  // --- Orders ---------------------------------------------------------------
  router.get('/orders', async (_req, res) => {
    const orders = await container.useCases.listAllOrders.execute();
    res.json({ items: orders.map(toAdminOrderDto) });
  });

  return router;
}
