/**
 * Composition root.
 *
 * The ONLY place where concrete infrastructure adapters are wired to the
 * application/domain pieces (blueprint §6). Manual constructor injection — no
 * DI framework. Each phase adds its adapters here; nothing else knows they
 * exist.
 */
import { env } from './config/env.js';
import { parseDurationToSeconds } from './config/duration.js';
import type { Hasher } from './domain/ports/hasher.js';
import type { UserRepository } from './domain/ports/user-repository.js';
import type { ProductRepository } from './domain/ports/product-repository.js';
import type { CategoryRepository } from './domain/ports/category-repository.js';
import type { OrderRepository } from './domain/ports/order-repository.js';
import type { EntitlementRepository } from './domain/ports/entitlement-repository.js';
import type { RefreshTokenRepository } from './domain/ports/refresh-token-repository.js';
import type { RefreshTokenGenerator } from './domain/ports/refresh-token-generator.js';
import type { UnitOfWork } from './domain/ports/unit-of-work.js';
import type { TokenService } from './domain/ports/token-service.js';
import { ArgonHasher } from './infrastructure/auth/argon.hasher.js';
import { JwtTokenService } from './infrastructure/auth/jwt.token-service.js';
import { CryptoRefreshTokenGenerator } from './infrastructure/auth/crypto-refresh-token.generator.js';
import { createDb, type Database } from './infrastructure/persistence/db.js';
import { DrizzleCategoryRepository } from './infrastructure/persistence/repositories/category.repository.js';
import { DrizzleEntitlementRepository } from './infrastructure/persistence/repositories/entitlement.repository.js';
import { DrizzleOrderRepository } from './infrastructure/persistence/repositories/order.repository.js';
import { DrizzleProductRepository } from './infrastructure/persistence/repositories/product.repository.js';
import { DrizzleRefreshTokenRepository } from './infrastructure/persistence/repositories/refresh-token.repository.js';
import { DrizzleUserRepository } from './infrastructure/persistence/repositories/user.repository.js';
import { DrizzleUnitOfWork } from './infrastructure/persistence/unit-of-work.js';
import { RegisterUser } from './application/auth/register-user.js';
import { LoginUser } from './application/auth/login-user.js';
import { GetMe } from './application/auth/get-me.js';
import { IssueTokenPair } from './application/auth/issue-token-pair.js';
import { RefreshSession } from './application/auth/refresh-session.js';
import { Logout } from './application/auth/logout.js';
import { SearchProducts } from './application/catalog/search-products.js';
import { GetProductBySlug } from './application/catalog/get-product-by-slug.js';
import { ListCategories } from './application/catalog/list-categories.js';
import { CreateOrder } from './application/ordering/create-order.js';
import { PayOrder } from './application/ordering/pay-order.js';
import { ListOrders } from './application/ordering/list-orders.js';
import { GetOrder } from './application/ordering/get-order.js';
import { ListLibrary } from './application/library/list-library.js';
import { CreateProduct } from './application/admin/create-product.js';
import { UpdateProduct } from './application/admin/update-product.js';
import { ChangeProductStatus } from './application/admin/change-product-status.js';
import { ListProductsForAdmin } from './application/admin/list-products.js';
import { ListAllOrders } from './application/admin/list-all-orders.js';
import { FulfillmentService } from './domain/services/fulfillment.js';
import { LicenseKeyGenerator } from './domain/services/license-key.js';
import { SimulatedPaymentGateway } from './infrastructure/payment/simulated-payment.gateway.js';
import type { PaymentGateway } from './domain/ports/payment-gateway.js';

export interface UseCases {
  registerUser: RegisterUser;
  loginUser: LoginUser;
  getMe: GetMe;
  refreshSession: RefreshSession;
  logout: Logout;
  searchProducts: SearchProducts;
  getProductBySlug: GetProductBySlug;
  listCategories: ListCategories;
  createOrder: CreateOrder;
  payOrder: PayOrder;
  listOrders: ListOrders;
  getOrder: GetOrder;
  listLibrary: ListLibrary;
  createProduct: CreateProduct;
  updateProduct: UpdateProduct;
  changeProductStatus: ChangeProductStatus;
  listProductsForAdmin: ListProductsForAdmin;
  listAllOrders: ListAllOrders;
}

export interface AppContainer {
  db: Database;
  /** Release the connection pool (called on graceful shutdown). */
  close(): Promise<void>;
  unitOfWork: UnitOfWork;
  hasher: Hasher;
  tokenService: TokenService;
  paymentGateway: PaymentGateway;
  userRepository: UserRepository;
  productRepository: ProductRepository;
  categoryRepository: CategoryRepository;
  orderRepository: OrderRepository;
  entitlementRepository: EntitlementRepository;
  refreshTokenRepository: RefreshTokenRepository;
  refreshTokenGenerator: RefreshTokenGenerator;
  useCases: UseCases;
}

export function buildContainer(options: { databaseUrl?: string } = {}): AppContainer {
  const { db, client } = createDb(options.databaseUrl ?? env.DATABASE_URL);

  const accessTokenTtlSeconds = parseDurationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN);
  const refreshTokenTtlSeconds = parseDurationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN);

  const unitOfWork = new DrizzleUnitOfWork(db);
  const hasher = new ArgonHasher();
  const tokenService = new JwtTokenService(env.JWT_SECRET, accessTokenTtlSeconds);
  const refreshTokenGenerator = new CryptoRefreshTokenGenerator();
  const paymentGateway = new SimulatedPaymentGateway();
  const fulfillment = new FulfillmentService(new LicenseKeyGenerator());

  const userRepository = new DrizzleUserRepository(db);
  const productRepository = new DrizzleProductRepository(db);
  const categoryRepository = new DrizzleCategoryRepository(db);
  const orderRepository = new DrizzleOrderRepository(db);
  const entitlementRepository = new DrizzleEntitlementRepository(db);
  const refreshTokenRepository = new DrizzleRefreshTokenRepository(db);

  const issueTokenPair = new IssueTokenPair({
    tokens: tokenService,
    refreshTokens: refreshTokenRepository,
    generator: refreshTokenGenerator,
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
  });

  const useCases: UseCases = {
    registerUser: new RegisterUser({ users: userRepository, hasher, issueTokenPair }),
    loginUser: new LoginUser({ users: userRepository, hasher, issueTokenPair }),
    getMe: new GetMe({ users: userRepository }),
    refreshSession: new RefreshSession({
      users: userRepository,
      refreshTokens: refreshTokenRepository,
      generator: refreshTokenGenerator,
      issueTokenPair,
      unitOfWork,
    }),
    logout: new Logout({ refreshTokens: refreshTokenRepository, generator: refreshTokenGenerator }),
    searchProducts: new SearchProducts({
      products: productRepository,
      categories: categoryRepository,
    }),
    getProductBySlug: new GetProductBySlug({ products: productRepository }),
    listCategories: new ListCategories({ categories: categoryRepository }),
    createOrder: new CreateOrder({
      products: productRepository,
      orders: orderRepository,
      entitlements: entitlementRepository,
    }),
    payOrder: new PayOrder({
      orders: orderRepository,
      payments: paymentGateway,
      unitOfWork,
      fulfillment,
    }),
    listOrders: new ListOrders({ orders: orderRepository }),
    getOrder: new GetOrder({ orders: orderRepository }),
    listLibrary: new ListLibrary({
      entitlements: entitlementRepository,
      products: productRepository,
    }),
    createProduct: new CreateProduct({
      products: productRepository,
      categories: categoryRepository,
    }),
    updateProduct: new UpdateProduct({
      products: productRepository,
      categories: categoryRepository,
    }),
    changeProductStatus: new ChangeProductStatus({ products: productRepository }),
    listProductsForAdmin: new ListProductsForAdmin({ products: productRepository }),
    listAllOrders: new ListAllOrders({ orders: orderRepository }),
  };

  return {
    db,
    close: () => client.end(),
    unitOfWork,
    hasher,
    tokenService,
    paymentGateway,
    userRepository,
    productRepository,
    categoryRepository,
    orderRepository,
    entitlementRepository,
    refreshTokenRepository,
    refreshTokenGenerator,
    useCases,
  };
}
