export type User = {
  id: string
  name: string
  email: string
  email_verified: boolean
  is_active: boolean
}

export type LoginResponse = {
  access_token: string
  token_type: string
  access_expires_at: string
  refresh_expires_at: string
  user: User
}

export type RegisterResponse = {
  user: User
}

export type RefreshResponse = {
  access_token: string
  token_type?: string
  access_expires_at?: string
  refresh_expires_at?: string
  user?: User
}

export type MeResponse = {
  user: {
    id: string
    name: string
    email: string
  }
  plan_code: string
  features: Record<string, boolean>
  limits: Record<string, number>
}
