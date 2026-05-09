export const FeatureFlagKey = {
  CHECKOUT_ENABLED: 'checkout_enabled',
  MP_ENABLED: 'mp_enabled',
  EMAIL_ENABLED: 'email_enabled',
  WHATSAPP_ENABLED: 'whatsapp_enabled',
  COUPON_ENABLED: 'coupon_enabled',
  FRAUD_STRICT_MODE: 'fraud_strict_mode',
  CREDIT_MODULE_ENABLED: 'credit_module_enabled',
  PHYSICAL_SALES_ENABLED: 'physical_sales_enabled',
} as const;

export type FeatureFlagKey = typeof FeatureFlagKey[keyof typeof FeatureFlagKey];

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateFeatureFlagData = {
  enabled: boolean;
  updatedBy: string | null;
};

export interface FeatureFlagPort {
  isEnabled(key: string, defaultValue?: boolean): Promise<boolean>;
  findAll(): Promise<FeatureFlag[]>;
  update(key: string, data: UpdateFeatureFlagData): Promise<FeatureFlag>;
}
