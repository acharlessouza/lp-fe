import { fetchJson } from '../services/api'
import type { LoginResponse, RefreshResponse, RegisterResponse } from './types'

export const login = (email: string, password: string) =>
  fetchJson<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    authenticated: false,
    body: {
      email,
      password,
    },
  })

export const register = (name: string, email: string, password: string) =>
  fetchJson<RegisterResponse>('/v1/auth/register', {
    method: 'POST',
    authenticated: false,
    body: {
      name,
      email,
      password,
    },
  })

export const loginWithGoogle = (idToken: string) =>
  fetchJson<LoginResponse>('/v1/auth/google', {
    method: 'POST',
    authenticated: false,
    body: {
      id_token: idToken,
    },
  })

export const refreshSession = () =>
  fetchJson<RefreshResponse>('/v1/auth/refresh', {
    method: 'POST',
    authenticated: false,
  })

export const forgotPassword = (email: string) =>
  fetchJson<{ ok?: boolean; message?: string }>('/v1/auth/password/forgot', {
    method: 'POST',
    authenticated: false,
    body: {
      email,
    },
  })

export const resetPassword = (token: string, newPassword: string) =>
  fetchJson<{ ok?: boolean; message?: string }>('/v1/auth/password/reset', {
    method: 'POST',
    authenticated: false,
    body: {
      token,
      new_password: newPassword,
    },
  })

export const logout = () =>
  fetchJson<{ ok?: boolean; message?: string }>('/v1/auth/logout', {
    method: 'POST',
  })
