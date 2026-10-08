/* eslint-disable @typescript-eslint/require-await -- in-memory fakes return
   resolved promises; they never need real asynchrony. */
import type { User, UserCreateInput } from '../../../src/domain/model/user.js';
import type { Category, CategoryCreateInput } from '../../../src/domain/model/category.js';
import type { Product, ProductCreateInput } from '../../../src/domain/model/product.js';
import type { UserRepository } from '../../../src/domain/ports/user-repository.js';
import type { CategoryRepository } from '../../../src/domain/ports/category-repository.js';
import type {
  ProductRepository,
  ProductSearchCriteria,
  PagedResult,
} from '../../../src/domain/ports/product-repository.js';
import type { Hasher } from '../../../src/domain/ports/hasher.js';
import type {
  TokenClaims,
  TokenPayload,
  TokenService,
} from '../../../src/domain/ports/token-service.js';
import type {
  RefreshToken,
  RefreshTokenCreateInput,
} from '../../../src/domain/model/refresh-token.js';
import type { RefreshTokenRepository } from '../../../src/domain/ports/refresh-token-repository.js';
import type { RefreshTokenGenerator } from '../../../src/domain/ports/refresh-token-generator.js';
import { UnauthorizedError } from '../../../src/domain/errors/index.js';

/**
 * In-memory fakes for application-layer tests — the hexagonal payoff: use
 * cases are exercised with zero DB and zero HTTP (blueprint §11).
 */

export class FakeHasher implements Hasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokenService implements TokenService {
  async sign(claims: TokenClaims): Promise<string> {
    return `token.${claims.sub}.${claims.role}`;
  }

  async verify(token: string): Promise<TokenPayload> {
    const [, sub, role] = token.split('.');
    if (!sub || !role) throw new UnauthorizedError('Invalid token');
    return { sub, role: role as TokenPayload['role'], iat: 0, exp: 0 };
  }
}

export class FakeRefreshTokenGenerator implements RefreshTokenGenerator {
  private sequence = 0;

  generate(): string {
    return `refresh-${++this.sequence}`;
  }

  hash(token: string): string {
    return `hash:${token}`;
  }

  generateFamilyId(): string {
    return `family-${++this.sequence}`;
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly rows = new Map<string, RefreshToken>();
  private sequence = 0;

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) return row;
    }
    return null;
  }

  async create(input: RefreshTokenCreateInput): Promise<RefreshToken> {
    const row: RefreshToken = {
      id: `rt-${++this.sequence}`,
      userId: input.userId,
      familyId: input.familyId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    this.rows.set(row.id, row);
    return row;
  }

  async revoke(id: string, revokedAt: Date): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.revokedAt) return false;
    row.revokedAt = revokedAt;
    return true;
  }

  async revokeFamily(familyId: string, revokedAt: Date): Promise<number> {
    let revoked = 0;
    for (const row of this.rows.values()) {
      if (row.familyId === familyId && !row.revokedAt) {
        row.revokedAt = revokedAt;
        revoked += 1;
      }
    }
    return revoked;
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, User>();
  private sequence = 0;

  async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.toLowerCase();
    for (const user of this.rows.values()) {
      if (user.email.toLowerCase() === needle) return user;
    }
    return null;
  }

  async create(input: UserCreateInput): Promise<User> {
    const user: User = {
      id: `u-${++this.sequence}`,
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    this.rows.set(user.id, user);
    return user;
  }
}

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly rows = new Map<string, Category>();
  private sequence = 0;

  async findAll(): Promise<Category[]> {
    return [...this.rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string): Promise<Category | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    for (const category of this.rows.values()) {
      if (category.slug === slug) return category;
    }
    return null;
  }

  async create(input: CategoryCreateInput): Promise<Category> {
    const category: Category = { id: `c-${++this.sequence}`, slug: input.slug, name: input.name };
    this.rows.set(category.id, category);
    return category;
  }
}

export class InMemoryProductRepository implements ProductRepository {
  private readonly rows = new Map<string, Product>();
  private sequence = 0;
  lastSearch: ProductSearchCriteria | null = null;

  seed(...products: Product[]): void {
    for (const product of products) this.rows.set(product.id, product);
  }

  async findById(id: string): Promise<Product | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    for (const product of this.rows.values()) {
      if (product.slug === slug) return product;
    }
    return null;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    return ids.map((id) => this.rows.get(id)).filter((row): row is Product => row !== undefined);
  }

  async search(criteria: ProductSearchCriteria): Promise<PagedResult<Product>> {
    this.lastSearch = criteria;
    let list = [...this.rows.values()];

    if (criteria.status) {
      list = list.filter((p) => p.status === criteria.status);
    }
    if (criteria.search) {
      const term = criteria.search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(term) || p.summary.toLowerCase().includes(term),
      );
    }
    if (criteria.categoryId) list = list.filter((p) => p.categoryId === criteria.categoryId);
    if (criteria.platform) list = list.filter((p) => p.platform === criteria.platform);
    if (criteria.minPriceCents !== undefined) {
      list = list.filter((p) => p.priceCents >= (criteria.minPriceCents as number));
    }
    if (criteria.maxPriceCents !== undefined) {
      list = list.filter((p) => p.priceCents <= (criteria.maxPriceCents as number));
    }

    list.sort((a, b) => {
      switch (criteria.sort) {
        case 'price_asc':
          return a.priceCents - b.priceCents;
        case 'price_desc':
          return b.priceCents - a.priceCents;
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

    const total = list.length;
    const start = (criteria.page - 1) * criteria.pageSize;
    return {
      items: list.slice(start, start + criteria.pageSize),
      page: criteria.page,
      pageSize: criteria.pageSize,
      total,
    };
  }

  async create(input: ProductCreateInput): Promise<Product> {
    const product: Product = {
      ...input,
      id: `p-${++this.sequence}`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    this.rows.set(product.id, product);
    return product;
  }

  async update(id: string, changes: Partial<Product>): Promise<Product | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...changes, updatedAt: new Date('2026-01-02T00:00:00.000Z') };
    this.rows.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, status: Product['status']): Promise<Product | null> {
    return this.update(id, { status });
  }
}

// --- Phase 5 fakes: orders, entitlements, payment, unit of work ---------------

import type { Order, OrderCreateInput } from '../../../src/domain/model/order.js';
import type { Entitlement, EntitlementCreateInput } from '../../../src/domain/model/entitlement.js';
import type { OrderRepository } from '../../../src/domain/ports/order-repository.js';
import type { EntitlementRepository } from '../../../src/domain/ports/entitlement-repository.js';
import type { PaymentGateway, CardDetails } from '../../../src/domain/ports/payment-gateway.js';
import type {
  UnitOfWork,
  TransactionRepositories,
} from '../../../src/domain/ports/unit-of-work.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();
  private sequence = 0;

  async findById(id: string): Promise<Order | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUser(userId: string): Promise<Order[]> {
    return [...this.rows.values()]
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findAll(): Promise<Order[]> {
    return [...this.rows.values()];
  }

  async create(input: OrderCreateInput): Promise<Order> {
    const id = `o-${++this.sequence}`;
    const order: Order = {
      id,
      userId: input.userId,
      status: 'PENDING',
      totalCents: input.totalCents,
      createdAt: new Date(Date.UTC(2026, 0, 1) + this.sequence * 1000),
      paidAt: null,
      items: input.items.map((item, index) => ({
        id: `oi-${index}`,
        orderId: id,
        productId: item.productId,
        titleSnapshot: item.titleSnapshot,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
    };
    this.rows.set(order.id, order);
    return order;
  }

  async transitionStatus(
    id: string,
    from: Order['status'],
    to: Order['status'],
    paidAt?: Date | null,
  ): Promise<Order | null> {
    const current = this.rows.get(id);
    if (!current || current.status !== from) return null;
    const updated: Order = { ...current, status: to, ...(paidAt !== undefined ? { paidAt } : {}) };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryEntitlementRepository implements EntitlementRepository {
  private readonly rows: Entitlement[] = [];

  async findByUser(userId: string): Promise<Entitlement[]> {
    return this.rows.filter((entry) => entry.userId === userId);
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<Entitlement | null> {
    return (
      this.rows.find((entry) => entry.userId === userId && entry.productId === productId) ?? null
    );
  }

  async findOwnedProductIds(userId: string): Promise<string[]> {
    return this.rows.filter((entry) => entry.userId === userId).map((entry) => entry.productId);
  }

  async createMany(input: EntitlementCreateInput[]): Promise<Entitlement[]> {
    const created = input.map((entry, index) => ({
      id: `e-${index}`,
      userId: entry.userId,
      productId: entry.productId,
      orderId: entry.orderId,
      licenseKey: entry.licenseKey,
      grantedAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    this.rows.push(...created);
    return created;
  }
}

export class FakePaymentGateway implements PaymentGateway {
  approve = true;

  async charge(
    card: CardDetails,
    _amountCents: number,
  ): Promise<
    | { approved: true; transactionId: string }
    | {
        approved: false;
        declinedReason: string;
      }
  > {
    void card;
    if (this.approve) return { approved: true, transactionId: 'tx-test' };
    return { approved: false, declinedReason: 'simulated_decline' };
  }
}

export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly repositories: TransactionRepositories) {}

  run<T>(work: (tx: TransactionRepositories) => Promise<T>): Promise<T> {
    return work(this.repositories);
  }
}
