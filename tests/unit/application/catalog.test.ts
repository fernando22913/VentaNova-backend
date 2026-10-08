import { describe, expect, it } from 'vitest';

import { SearchProducts } from '../../../src/application/catalog/search-products.js';
import { GetProductBySlug } from '../../../src/application/catalog/get-product-by-slug.js';
import { ListCategories } from '../../../src/application/catalog/list-categories.js';
import { NotFoundError } from '../../../src/domain/errors/index.js';
import type { Product } from '../../../src/domain/model/product.js';
import { InMemoryCategoryRepository, InMemoryProductRepository } from '../helpers/fakes.js';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? 'p-1',
    slug: overrides.slug ?? 'neo-racer',
    title: overrides.title ?? 'Neo Racer',
    summary: overrides.summary ?? 'A racer.',
    description: overrides.description ?? 'Full description.',
    type: overrides.type ?? 'GAME',
    platform: overrides.platform ?? 'CROSS',
    categoryId: overrides.categoryId ?? 'c-games',
    priceCents: overrides.priceCents ?? 3999,
    status: overrides.status ?? 'PUBLISHED',
    coverImageUrl: overrides.coverImageUrl ?? null,
    assetUrl: overrides.assetUrl ?? 'https://cdn.example.com/x.zip',
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('SearchProducts', () => {
  it('always searches PUBLISHED products only', async () => {
    const products = new InMemoryProductRepository();
    products.seed(
      makeProduct({ id: 'p-1', slug: 'published', status: 'PUBLISHED' }),
      makeProduct({ id: 'p-2', slug: 'draft', status: 'DRAFT' }),
    );
    const search = new SearchProducts({ products, categories: new InMemoryCategoryRepository() });

    const result = await search.execute({ sort: 'newest', page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0]?.slug).toBe('published');
    expect(products.lastSearch?.status).toBe('PUBLISHED');
  });

  it('maps a public category slug to the internal category id', async () => {
    const categories = new InMemoryCategoryRepository();
    const games = await categories.create({ slug: 'games', name: 'Games' });

    const products = new InMemoryProductRepository();
    products.seed(
      makeProduct({ id: 'p-1', slug: 'a', categoryId: games.id }),
      makeProduct({ id: 'p-2', slug: 'b', categoryId: 'other' }),
    );
    const search = new SearchProducts({ products, categories });

    const result = await search.execute({
      category: 'games',
      sort: 'newest',
      page: 1,
      pageSize: 10,
    });
    expect(result.items.map((p) => p.id)).toEqual(['p-1']);
  });

  it('returns an empty page for an unknown category slug', async () => {
    const products = new InMemoryProductRepository();
    products.seed(makeProduct());
    const search = new SearchProducts({
      products,
      categories: new InMemoryCategoryRepository(),
    });

    const result = await search.execute({ category: 'nope', sort: 'newest', page: 1, pageSize: 5 });
    expect(result).toEqual({ items: [], page: 1, pageSize: 5, total: 0 });
  });

  it('passes price range and sort through to the repository', async () => {
    const products = new InMemoryProductRepository();
    products.seed(
      makeProduct({ id: 'p-1', slug: 'cheap', priceCents: 500 }),
      makeProduct({ id: 'p-2', slug: 'mid', priceCents: 2500 }),
      makeProduct({ id: 'p-3', slug: 'pricey', priceCents: 9000 }),
    );
    const search = new SearchProducts({ products, categories: new InMemoryCategoryRepository() });

    const result = await search.execute({
      minPriceCents: 1000,
      maxPriceCents: 3000,
      sort: 'price_asc',
      page: 1,
      pageSize: 10,
    });
    expect(result.items.map((p) => p.slug)).toEqual(['mid']);
    expect(products.lastSearch).toMatchObject({
      minPriceCents: 1000,
      maxPriceCents: 3000,
      sort: 'price_asc',
    });
  });
});

describe('GetProductBySlug', () => {
  it('returns a published product', async () => {
    const products = new InMemoryProductRepository();
    products.seed(makeProduct({ slug: 'neo-racer' }));
    const get = new GetProductBySlug({ products });

    const product = await get.execute('neo-racer');
    expect(product.slug).toBe('neo-racer');
  });

  it('coerces unpublished products to 404', async () => {
    const products = new InMemoryProductRepository();
    products.seed(makeProduct({ slug: 'draft-racer', status: 'DRAFT' }));
    const get = new GetProductBySlug({ products });

    await expect(get.execute('draft-racer')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('404s on an unknown slug', async () => {
    const get = new GetProductBySlug({ products: new InMemoryProductRepository() });
    await expect(get.execute('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ListCategories', () => {
  it('returns all categories, aliasing the repository result', async () => {
    const categories = new InMemoryCategoryRepository();
    await categories.create({ slug: 'asset', name: 'Assets' });
    await categories.create({ slug: 'game', name: 'Games' });

    const result = await new ListCategories({ categories }).execute();
    expect(result.map((c) => c.slug)).toEqual(['asset', 'game']); // sorted by name (A < G)
  });
});
