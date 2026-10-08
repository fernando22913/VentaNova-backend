export interface Entitlement {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  licenseKey: string;
  grantedAt: Date;
}

export interface EntitlementCreateInput {
  userId: string;
  productId: string;
  orderId: string;
  licenseKey: string;
}
