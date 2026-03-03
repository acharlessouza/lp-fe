import { Navigate, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/" replace state={{ openAuth: 'login', from }} />
  }

  return children
}
