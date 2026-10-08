export type { Product, ProductCreateInput, ProductUpdateInput } from './product.js';

export type { Category, CategoryCreateInput } from './category.js';
export type { User, UserCreateInput } from './user.js';
export type { RefreshToken, RefreshTokenCreateInput } from './refresh-token.js';
export type { Order, OrderItem, OrderCreateInput, OrderItemCreateInput } from './order.js';
export type { Entitlement, EntitlementCreateInput } from './entitlement.js';

export type {
  ProductType,
  ProductPlatform,
  ProductStatus,
  UserRole,
  OrderStatus,
} from './enums.js';

export {
  PRODUCT_TYPES,
  PRODUCT_PLATFORMS,
  PRODUCT_STATUSES,
  USER_ROLES,
  ORDER_STATUSES,
  isProductType,
  isProductPlatform,
  isProductStatus,
  isUserRole,
  isOrderStatus,
} from './enums.js';

export { Money } from './money.js';
export { canTransitionOrder, assertOrderTransition } from './order-status.js';
