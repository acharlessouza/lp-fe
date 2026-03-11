import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { AdminAccessDenied } from './AdminAccessDenied'

type RequirePermissionProps = {
  children: ReactElement
  permission: string
}

export function RequirePermission({ children, permission }: RequirePermissionProps) {
  const location = useLocation()
  const { hasAdminPermission, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/" replace state={{ openAuth: 'login', from }} />
  }

  if (!hasAdminPermission(permission)) {
    return <AdminAccessDenied />
  }

  return children
}
