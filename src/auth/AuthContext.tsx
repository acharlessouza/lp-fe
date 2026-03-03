import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login, loginWithGoogle, logout, refreshSession, register } from './authApi'
import type { User } from './types'
import { setAccessToken, setOnUnauthorized } from '../services/api'

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: (idToken: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

type AuthStorage = {
  accessToken: string
  user: User | null
}

const AUTH_STORAGE_KEY = 'pool_atlas_auth'

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const parseStoredUser = (value: unknown): User | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const user = value as Partial<User>
  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.email_verified !== 'boolean' ||
    typeof user.is_active !== 'boolean'
  ) {
    return null
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    is_active: user.is_active,
  }
}

const readStoredAuth = (): AuthStorage | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const accessTokenValue = (parsed as { accessToken?: unknown }).accessToken
    if (typeof accessTokenValue !== 'string' || !accessTokenValue.trim()) {
      return null
    }

    const userValue = (parsed as { user?: unknown }).user
    return {
      accessToken: accessTokenValue.trim(),
      user: parseStoredUser(userValue),
    }
  } catch {
    return null
  }
}

const persistAuth = (payload: AuthStorage | null) => {
  if (typeof window === 'undefined') {
    return
  }
  if (!payload) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setAuthState = useCallback((token: string | null, nextUser: User | null) => {
    setAccessTokenState(token)
    setUser(nextUser)
    setAccessToken(token)
    if (!token) {
      persistAuth(null)
      return
    }
    persistAuth({
      accessToken: token,
      user: nextUser,
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrapSession = async () => {
      const stored = readStoredAuth()
      if (stored) {
        setAccessTokenState(stored.accessToken)
        setUser(stored.user)
        setAccessToken(stored.accessToken)
      } else {
        setAccessToken(null)
      }

      try {
        const refreshed = await refreshSession()
        if (cancelled) {
          return
        }
        const resolvedUser = refreshed.user ?? stored?.user ?? null
        setAuthState(refreshed.access_token, resolvedUser)
      } catch {
        if (!cancelled) {
          setAuthState(null, null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [setAuthState])

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthState(null, null)
      const currentPath = `${location.pathname}${location.search}`
      navigate('/', {
        replace: true,
        state: {
          openAuth: 'login',
          from: currentPath,
        },
      })
    }
    setOnUnauthorized(handleUnauthorized)
    return () => {
      setOnUnauthorized(null)
    }
  }, [location.pathname, location.search, navigate, setAuthState])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await login(email, password)
      setAuthState(result.access_token, result.user)
    },
    [setAuthState],
  )

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const result = await loginWithGoogle(idToken)
      setAuthState(result.access_token, result.user)
    },
    [setAuthState],
  )

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      await register(name, email, password)
      await signIn(email, password)
    },
    [signIn],
  )

  const signOut = useCallback(async () => {
    try {
      await logout()
    } catch {
      // local sign-out must always proceed even when backend logout fails
    } finally {
      setAuthState(null, null)
    }
  }, [setAuthState])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken: accessTokenState,
      isLoading,
      isAuthenticated: Boolean(accessTokenState),
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
    }),
    [accessTokenState, isLoading, signIn, signInWithGoogle, signOut, signUp, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
