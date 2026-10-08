import { describe, expect, it } from 'vitest';

import { CreateProduct } from '../../../src/application/admin/create-product.js';
import { UpdateProduct } from '../../../src/application/admin/update-product.js';
import { ChangeProductStatus } from '../../../src/application/admin/change-product-status.js';
import { ListProductsForAdmin } from '../../../src/application/admin/list-products.js';
import { ListAllOrders } from '../../../src/application/admin/list-all-orders.js';
import { ConflictError, NotFoundError } from '../../../src/domain/errors/index.js';
import type { Product } from '../../../src/domain/model/product.js';
import {
  InMemoryCategoryRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
} from '../helpers/fakes.js';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? 'p-1',
    slug: overrides.slug ?? 'neo-racer',
    title: overrides.title ?? 'Neo Racer',
    summary: 'Summary.',
    description: 'Description.',
    type: 'GAME',
    platform: 'CROSS',
    categoryId: overrides.categoryId ?? 'c-1',
    priceCents: overrides.priceCents ?? 1999,
    status: overrides.status ?? 'PUBLISHED',
    coverImageUrl: null,
    assetUrl: 'https://cdn.example.com/x.zip',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

async function setup() {
  const products = new InMemoryProductRepository();
  const categories = new InMemoryCategoryRepository();
  const category = await categories.create({ slug: 'games', name: 'Games' });
  return { products, categories, category };
}

describe('admin product use cases', () => {
  it('CreateProduct creates a product when slug is free and category exists', async () => {
    const { products, categories, category } = await setup();
    const create = new CreateProduct({ products, categories });

    const created = await create.execute({
      slug: 'new-game',
      title: 'New Game',
      summary: 'S',
      description: 'D',
      type: 'GAME',
      platform: 'WINDOWS',
      categoryId: category.id,
      priceCents: 2500,
      coverImageUrl: null,
      assetUrl: 'https://cdn.example.com/new.zip',
      status: 'DRAFT',
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe('DRAFT');
  });

  it('CreateProduct rejects a taken slug and an unknown category', async () => {
    const { products, categories, category } = await setup();
    products.seed(product({ slug: 'taken' }));
    const create = new CreateProduct({ products, categories });

    await expect(
      create.execute({
        slug: 'taken',
        title: 'T',
        summary: 'S',
        description: 'D',
        type: 'GAME',
        platform: 'CROSS',
        categoryId: category.id,
        priceCents: 100,
        coverImageUrl: null,
        assetUrl: 'https://cdn.example.com/x.zip',
        status: 'DRAFT',
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      create.execute({
        slug: 'free',
        title: 'T',
        summary: 'S',
        description: 'D',
        type: 'GAME',
        platform: 'CROSS',
        categoryId: 'missing',
        priceCents: 100,
        coverImageUrl: null,
        assetUrl: 'https://cdn.example.com/x.zip',
        status: 'DRAFT',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('UpdateProduct edits fields and guards slug collisions', async () => {
    const { products, categories } = await setup();
    products.seed(product({ id: 'p-1', slug: 'a' }), product({ id: 'p-2', slug: 'b' }));
    const update = new UpdateProduct({ products, categories });

    const edited = await update.execute('p-1', { title: 'Edited', priceCents: 500 });
    expect(edited.title).toBe('Edited');
    expect(edited.priceCents).toBe(500);

    await expect(update.execute('p-1', { slug: 'b' })).rejects.toBeInstanceOf(ConflictError);
    await expect(update.execute('p-9', { title: 'x' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ChangeProductStatus publishes and archives (soft delete)', async () => {
    const { products } = await setup();
    products.seed(product({ id: 'p-1', status: 'DRAFT' }));
    const change = new ChangeProductStatus({ products });

    expect((await change.execute('p-1', 'PUBLISHED')).status).toBe('PUBLISHED');
    expect((await change.execute('p-1', 'ARCHIVED')).status).toBe('ARCHIVED');
    await expect(change.execute('p-9', 'PUBLISHED')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('ListProductsForAdmin can return every status', async () => {
    const { products } = await setup();
    products.seed(
      product({ id: 'p-1', slug: 'a', status: 'PUBLISHED' }),
      product({ id: 'p-2', slug: 'b', status: 'DRAFT' }),
      product({ id: 'p-3', slug: 'c', status: 'ARCHIVED' }),
    );
    const list = new ListProductsForAdmin({ products });

    const all = await list.execute({ sort: 'title', page: 1, pageSize: 10 });
    expect(all.total).toBe(3);

    const onlyDrafts = await list.execute({
      status: 'DRAFT',
      sort: 'title',
      page: 1,
      pageSize: 10,
    });
    expect(onlyDrafts.items.map((p) => p.slug)).toEqual(['b']);
  });
});

describe('ListAllOrders', () => {
  it('returns orders across every user', async () => {
    const orders = new InMemoryOrderRepository();
    await orders.create({
      userId: 'u-1',
      totalCents: 100,
      items: [{ productId: 'p-1', titleSnapshot: 'T', unitPriceCents: 100, quantity: 1 }],
    });
    await orders.create({
      userId: 'u-2',
      totalCents: 200,
      items: [{ productId: 'p-1', titleSnapshot: 'T', unitPriceCents: 200, quantity: 1 }],
    });

    const all = await new ListAllOrders({ orders }).execute();
    expect(all).toHaveLength(2);
  });
});
