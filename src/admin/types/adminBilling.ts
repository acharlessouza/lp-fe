export type AdminBillingPrice = {
  id: string
  interval: 'month' | 'year' | string
  currency: string
  amount_cents: number
  is_active: boolean
  external_price_id: string | null
}

export type AdminBillingPlan = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  is_public: boolean
  sort_order: number
  external_product_id: string | null
  prices: AdminBillingPrice[]
}

export type AdminBillingFeature = {
  id: string
  code: string
  name: string
  description: string | null
  type: 'boolean' | 'limit' | string
}

export type AdminBillingPlanFeatureGrant = {
  feature_id: string
  feature_code: string
  feature_name: string
  feature_description: string | null
  feature_type: 'boolean' | 'limit' | string
  is_enabled: boolean
  limit_value: number | null
}

export type AdminBillingPlanFeaturesUpdateItem = {
  feature_code: string
  is_enabled: boolean
  limit_value: number | null
}

export type AdminBillingPlanFeaturesUpdatePayload = {
  items: AdminBillingPlanFeaturesUpdateItem[]
}

export type CreateAdminBillingPlanPayload = {
  code: string
  name: string
  description: string | null
  is_active: boolean
  is_public: boolean
  sort_order: number
}

export type UpdateAdminBillingPlanPayload = {
  name: string
  description: string | null
  is_active: boolean
  is_public: boolean
  sort_order: number
}

export type CreateAdminBillingPricePayload = {
  interval: 'month' | 'year'
  amount_cents: number
  is_active: boolean
}

export type UpdateAdminBillingPricePayload = {
  is_active: boolean
}
