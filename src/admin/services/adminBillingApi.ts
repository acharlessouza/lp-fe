import { fetchJson } from '../../services/api'
import type {
  AdminBillingFeature,
  AdminBillingPlan,
  AdminBillingPlanFeatureGrant,
  AdminBillingPlanFeaturesUpdatePayload,
  AdminBillingPrice,
  CreateAdminBillingPlanPayload,
  CreateAdminBillingPricePayload,
  UpdateAdminBillingPlanPayload,
  UpdateAdminBillingPricePayload,
} from '../types/adminBilling'

export const getAdminBillingPlans = () => fetchJson<AdminBillingPlan[]>('/v1/admin/billing/plans')

export const getAdminBillingPlan = (planId: string) =>
  fetchJson<AdminBillingPlan>(`/v1/admin/billing/plans/${planId}`)

export const createAdminBillingPlan = (payload: CreateAdminBillingPlanPayload) =>
  fetchJson<AdminBillingPlan>('/v1/admin/billing/plans', {
    method: 'POST',
    body: payload,
  })

export const updateAdminBillingPlan = (planId: string, payload: UpdateAdminBillingPlanPayload) =>
  fetchJson<AdminBillingPlan>(`/v1/admin/billing/plans/${planId}`, {
    method: 'PATCH',
    body: payload,
  })

export const getAdminBillingFeatures = () =>
  fetchJson<AdminBillingFeature[]>('/v1/admin/billing/features')

export const getAdminBillingPlanFeatures = (planId: string) =>
  fetchJson<AdminBillingPlanFeatureGrant[]>(`/v1/admin/billing/plans/${planId}/features`)

export const updateAdminBillingPlanFeatures = (
  planId: string,
  payload: AdminBillingPlanFeaturesUpdatePayload,
) =>
  fetchJson<AdminBillingPlanFeatureGrant[]>(`/v1/admin/billing/plans/${planId}/features`, {
    method: 'PUT',
    body: payload,
  })

export const getAdminBillingPlanPrices = (planId: string) =>
  fetchJson<AdminBillingPrice[]>(`/v1/admin/billing/plans/${planId}/prices`)

export const createAdminBillingPlanPrice = (planId: string, payload: CreateAdminBillingPricePayload) =>
  fetchJson<AdminBillingPrice>(`/v1/admin/billing/plans/${planId}/prices`, {
    method: 'POST',
    body: payload,
  })

export const updateAdminBillingPrice = (priceId: string, payload: UpdateAdminBillingPricePayload) =>
  fetchJson<AdminBillingPrice>(`/v1/admin/billing/prices/${priceId}`, {
    method: 'PATCH',
    body: payload,
  })
