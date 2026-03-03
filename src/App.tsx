import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { forgotPassword } from './auth/authApi'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthContext'
import { requestIdToken } from './auth/google'
import DiscoverPage from './pages/DiscoverPage'
import HomePage from './pages/HomePage'
import PoolDetailPage from './pages/PoolDetailPage'
import PricingPage from './pages/PricingPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SimulatePage from './pages/SimulatePage'
import './App.css'

type ThemeOption = {
  id: string
  label: string
  bg: string
  bg2: string
  bg3: string
  bg4: string
  bg5: string
  border: string
  border2: string
  text: string
  text2: string
  text3: string
  accent: string
  accent2: string
  swatch: string
}

const THEMES: ThemeOption[] = [
  {
    id: 'cyan',
    label: 'Cyan Night',
    bg: '#070b0f',
    bg2: '#0d1117',
    bg3: '#131b24',
    bg4: '#1a2535',
    bg5: '#1f2d40',
    border: 'rgba(99,179,237,0.1)',
    border2: 'rgba(99,179,237,0.2)',
    text: '#e2eaf4',
    text2: '#7a9cbf',
    text3: '#3d5a78',
    accent: '#00d4ff',
    accent2: '#0099cc',
    swatch: 'linear-gradient(135deg,#070b0f 50%,#00d4ff 50%)',
  },
  {
    id: 'purple',
    label: 'Deep Purple',
    bg: '#09090f',
    bg2: '#0e0e1a',
    bg3: '#141425',
    bg4: '#1a1a30',
    bg5: '#1f1f38',
    border: 'rgba(120,100,200,0.12)',
    border2: 'rgba(120,100,200,0.28)',
    text: '#e8e8f0',
    text2: '#9494b0',
    text3: '#5a5a78',
    accent: '#7c6af7',
    accent2: '#a995ff',
    swatch: 'linear-gradient(135deg,#09090f 50%,#7c6af7 50%)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    bg: '#080f0a',
    bg2: '#0d1710',
    bg3: '#11211a',
    bg4: '#172c22',
    bg5: '#1c3629',
    border: 'rgba(52,211,153,0.1)',
    border2: 'rgba(52,211,153,0.2)',
    text: '#e0f0ea',
    text2: '#6aab8a',
    text3: '#2d6048',
    accent: '#10d670',
    accent2: '#07a854',
    swatch: 'linear-gradient(135deg,#080f0a 50%,#10d670 50%)',
  },
  {
    id: 'amber',
    label: 'Amber Dark',
    bg: '#0c0900',
    bg2: '#140f02',
    bg3: '#1e1603',
    bg4: '#271d04',
    bg5: '#302406',
    border: 'rgba(245,158,11,0.12)',
    border2: 'rgba(245,158,11,0.25)',
    text: '#f5ead0',
    text2: '#b8952a',
    text3: '#7a5f0e',
    accent: '#f59e0b',
    accent2: '#d97706',
    swatch: 'linear-gradient(135deg,#0c0900 50%,#f59e0b 50%)',
  },
  {
    id: 'rose',
    label: 'Rose Noir',
    bg: '#0f070a',
    bg2: '#180b0f',
    bg3: '#220f16',
    bg4: '#2d141e',
    bg5: '#381826',
    border: 'rgba(244,63,94,0.12)',
    border2: 'rgba(244,63,94,0.25)',
    text: '#f5dde4',
    text2: '#c06070',
    text3: '#7a3545',
    accent: '#f43f5e',
    accent2: '#e11d48',
    swatch: 'linear-gradient(135deg,#0f070a 50%,#f43f5e 50%)',
  },
  {
    id: 'slate',
    label: 'Slate Light',
    bg: '#f0f4f8',
    bg2: '#ffffff',
    bg3: '#e8edf4',
    bg4: '#d9e2ef',
    bg5: '#c8d4e3',
    border: 'rgba(60,80,120,0.12)',
    border2: 'rgba(60,80,120,0.22)',
    text: '#1a2540',
    text2: '#4a6080',
    text3: '#8a9ab8',
    accent: '#2563eb',
    accent2: '#1d4ed8',
    swatch: 'linear-gradient(135deg,#f0f4f8 50%,#2563eb 50%)',
  },
  {
    id: 'nord',
    label: 'Nord',
    bg: '#1a1e2a',
    bg2: '#242938',
    bg3: '#2e3447',
    bg4: '#38404f',
    bg5: '#424d60',
    border: 'rgba(136,192,208,0.12)',
    border2: 'rgba(136,192,208,0.25)',
    text: '#eceff4',
    text2: '#88c0d0',
    text3: '#4c566a',
    accent: '#88c0d0',
    accent2: '#81a1c1',
    swatch: 'linear-gradient(135deg,#1a1e2a 50%,#88c0d0 50%)',
  },
  {
    id: 'peach',
    label: 'Peach Dusk',
    bg: '#0e0808',
    bg2: '#160e0e',
    bg3: '#1e1414',
    bg4: '#281a1a',
    bg5: '#322020',
    border: 'rgba(251,146,60,0.12)',
    border2: 'rgba(251,146,60,0.25)',
    text: '#fce8d8',
    text2: '#c07850',
    text3: '#7a4830',
    accent: '#fb923c',
    accent2: '#ea7a28',
    swatch: 'linear-gradient(135deg,#0e0808 50%,#fb923c 50%)',
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    bg: '#050914',
    bg2: '#090f1e',
    bg3: '#0d1528',
    bg4: '#111b32',
    bg5: '#16213d',
    border: 'rgba(96,165,250,0.12)',
    border2: 'rgba(96,165,250,0.25)',
    text: '#dceeff',
    text2: '#5a88c0',
    text3: '#2a4878',
    accent: '#60a5fa',
    accent2: '#3b82f6',
    swatch: 'linear-gradient(135deg,#050914 50%,#60a5fa 50%)',
  },
  {
    id: 'forest',
    label: 'Forest',
    bg: '#050c08',
    bg2: '#0a1410',
    bg3: '#0f1c17',
    bg4: '#14241e',
    bg5: '#192d26',
    border: 'rgba(74,222,128,0.1)',
    border2: 'rgba(74,222,128,0.2)',
    text: '#d8f0e0',
    text2: '#509870',
    text3: '#286048',
    accent: '#4ade80',
    accent2: '#22c55e',
    swatch: 'linear-gradient(135deg,#050c08 50%,#4ade80 50%)',
  },
]

const THEME_STORAGE_KEY = 'pool_atlas_theme'
const DEFAULT_THEME_ID = 'slate'
type AuthModalType = 'login' | 'signup' | 'forgot' | null

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(37, 99, 235, ${alpha})`
  }
  const intValue = Number.parseInt(expanded, 16)
  const r = (intValue >> 16) & 255
  const g = (intValue >> 8) & 255
  const b = intValue & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const applyTheme = (theme: ThemeOption) => {
  const root = document.documentElement.style
  root.setProperty('--bg', theme.bg)
  root.setProperty('--bg2', theme.bg2)
  root.setProperty('--bg3', theme.bg3)
  root.setProperty('--bg4', theme.bg4)
  root.setProperty('--bg5', theme.bg5)
  root.setProperty('--border', theme.border)
  root.setProperty('--border2', theme.border2)
  root.setProperty('--text', theme.text)
  root.setProperty('--text2', theme.text2)
  root.setProperty('--text3', theme.text3)
  root.setProperty('--accent', theme.accent)
  root.setProperty('--accent2', theme.accent2)
  root.setProperty('--accentg', hexToRgba(theme.accent, 0.12))
  root.setProperty('--accentg-soft', hexToRgba(theme.accent, 0.06))
  root.setProperty('--accentg-strong', hexToRgba(theme.accent, 0.25))
  root.setProperty('--accentg-border', hexToRgba(theme.accent, 0.3))
  root.setProperty('--accentg-focus', hexToRgba(theme.accent, 0.5))
  root.setProperty('--accentg-selection', hexToRgba(theme.accent, 0.22))

  // Compatibility tokens used by older page styles.
  root.setProperty('--surface', theme.bg2)
  root.setProperty('--surface-solid', theme.bg2)
  root.setProperty('--accent-strong', theme.accent2)
  root.setProperty('--ink', theme.text)
  root.setProperty('--muted', theme.text2)
  root.setProperty(
    '--shadow-soft',
    theme.id === 'slate'
      ? '0 20px 50px rgba(60, 80, 120, 0.16)'
      : '0 20px 50px rgba(0, 0, 0, 0.25)',
  )
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, signIn, signInWithGoogle, signOut, signUp } = useAuth()
  const isHomeRoute = location.pathname === '/'
  const isPricingRoute = location.pathname.startsWith('/pricing')
  const isRadarRoute = location.pathname.startsWith('/radar')
  const isSimulateRoute = location.pathname.startsWith('/simulate')
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false)
  const [authModal, setAuthModal] = useState<AuthModalType>(null)
  const [authRedirectPath, setAuthRedirectPath] = useState<string | null>(null)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginNotice, setLoginNotice] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginGoogleLoading, setLoginGoogleLoading] = useState(false)
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupError, setSignupError] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupGoogleLoading, setSignupGoogleLoading] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotFeedback, setForgotFeedback] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [themeId, setThemeId] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_THEME_ID
    }
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (!stored) {
      return DEFAULT_THEME_ID
    }
    return THEMES.some((theme) => theme.id === stored) ? stored : DEFAULT_THEME_ID
  })
  const themePickerRef = useRef<HTMLDivElement | null>(null)

  const currentTheme = useMemo(
    () => THEMES.find((theme) => theme.id === themeId) ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!,
    [themeId],
  )

  useEffect(() => {
    applyTheme(currentTheme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme.id)
    }
  }, [currentTheme])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!themePickerRef.current) {
        return
      }
      if (!themePickerRef.current.contains(event.target as Node)) {
        setIsThemePickerOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsThemePickerOpen(false)
        setAuthModal(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (authModal) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
    document.body.style.overflow = ''
    return undefined
  }, [authModal])

  useEffect(() => {
    const state = location.state as
      | {
          openAuth?: AuthModalType
          from?: string
          authNotice?: string
        }
      | null

    if (!state?.openAuth) {
      return
    }

    setAuthModal(state.openAuth)
    setAuthRedirectPath(state.from ?? null)
    setIsThemePickerOpen(false)
    setLoginError('')
    setLoginNotice(state.authNotice ?? '')
    setSignupError('')
    setForgotError('')
    setForgotFeedback('')

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      { replace: true, state: null },
    )
  }, [location.pathname, location.search, location.state, navigate])

  const openAuth = (type: Exclude<AuthModalType, null>, redirectPath: string | null = null) => {
    setAuthModal(type)
    setAuthRedirectPath(redirectPath)
    setIsThemePickerOpen(false)
    if (type === 'login') {
      setLoginError('')
      setLoginNotice('')
      setForgotError('')
      setForgotFeedback('')
    } else if (type === 'forgot') {
      setForgotError('')
      setForgotFeedback('')
      setLoginError('')
      setLoginNotice('')
    } else {
      setSignupError('')
    }
  }

  const closeAuth = () => {
    if (
      loginLoading ||
      signupLoading ||
      forgotLoading ||
      loginGoogleLoading ||
      signupGoogleLoading ||
      logoutLoading
    ) {
      return
    }
    setAuthModal(null)
    setAuthRedirectPath(null)
  }

  const completeAuthFlow = () => {
    setAuthModal(null)
    setAuthRedirectPath(null)
    setLoginError('')
    setLoginNotice('')
    setSignupError('')
    setForgotError('')
    setForgotFeedback('')
    setForgotEmail('')
    const currentPath = `${location.pathname}${location.search}`
    const destination = authRedirectPath || currentPath || '/simulate'
    navigate(destination, { replace: true })
  }

  const handleProtectedNav = (path: string) => {
    if (!isAuthenticated) {
      openAuth('login', path)
      return
    }
    navigate(path)
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')

    const email = loginEmail.trim()
    if (!email || !loginPassword) {
      setLoginError('Please provide email and password.')
      return
    }

    setLoginLoading(true)
    try {
      await signIn(email, loginPassword)
      setLoginEmail('')
      setLoginPassword('')
      completeAuthFlow()
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSignupError('')

    const name = signupName.trim()
    const email = signupEmail.trim()
    if (!name || !email || !signupPassword) {
      setSignupError('Please fill in all required fields.')
      return
    }

    setSignupLoading(true)
    try {
      await signUp(name, email, signupPassword)
      setSignupName('')
      setSignupEmail('')
      setSignupPassword('')
      completeAuthFlow()
    } catch (error) {
      setSignupError(error instanceof Error ? error.message : 'Unable to create account.')
    } finally {
      setSignupLoading(false)
    }
  }

  const handleGoogleAuth = async (mode: 'login' | 'signup') => {
    if (mode === 'login') {
      setLoginError('')
      setLoginNotice('')
      setLoginGoogleLoading(true)
    } else {
      setSignupError('')
      setSignupGoogleLoading(true)
    }

    try {
      const idToken = await requestIdToken()
      await signInWithGoogle(idToken)
      completeAuthFlow()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to continue with Google.'
      if (mode === 'login') {
        setLoginError(message)
      } else {
        setSignupError(message)
      }
    } finally {
      if (mode === 'login') {
        setLoginGoogleLoading(false)
      } else {
        setSignupGoogleLoading(false)
      }
    }
  }

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setForgotError('')
    setForgotFeedback('')
    const email = forgotEmail.trim()
    if (!email) {
      setForgotError('Please provide your email address.')
      return
    }

    setForgotLoading(true)
    try {
      await forgotPassword(email)
    } catch {
      // Always return a generic message to avoid account enumeration.
    } finally {
      setForgotLoading(false)
      setForgotFeedback('If an account exists for this email, a reset link has been sent.')
    }
  }

  const handleLogout = async () => {
    if (logoutLoading) {
      return
    }
    setLogoutLoading(true)
    try {
      await signOut()
    } finally {
      setLogoutLoading(false)
      setAuthModal(null)
      setAuthRedirectPath(null)
      navigate('/', { replace: true })
    }
  }

  const isForgotMode = authModal === 'forgot'
  const loginBusy = loginLoading || loginGoogleLoading
  const signupBusy = signupLoading || signupGoogleLoading

  return (
    <div className="app">
      <header className="nav">
        <Link className="brand" to="/" aria-label="Pool Atlas">
          <span className="brand-logo" aria-hidden="true">
            PA
          </span>
          <span className="brand-name">Pool Atlas</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link className={`nl${isHomeRoute ? ' active' : ''}`} to="/">
            Home
          </Link>
          <button
            type="button"
            className={`nl${isRadarRoute ? ' active' : ''}`}
            onClick={() => handleProtectedNav('/radar')}
          >
            Radar
          </button>
          <button
            type="button"
            className={`nl${isSimulateRoute ? ' active' : ''}`}
            onClick={() => handleProtectedNav('/simulate')}
          >
            Simulate
          </button>
          <a className="nl dis" href="#" aria-disabled="true" onClick={(event) => event.preventDefault()}>
            Track
          </a>
          <Link className={`nl${isPricingRoute ? ' active' : ''}`} to="/pricing">
            Pricing
          </Link>
        </nav>

        <div className="nav-r">
          <div className="theme-picker-wrap" ref={themePickerRef}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Color theme"
              aria-label="Color theme"
              aria-expanded={isThemePickerOpen}
              onClick={() => setIsThemePickerOpen((current) => !current)}
            >
              🎨
            </button>
            {isThemePickerOpen ? (
              <div className="theme-picker-panel" role="dialog" aria-label="Color Theme">
                <div className="theme-picker-title">Color Theme</div>
                <div className="theme-grid">
                  {THEMES.map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      className={`theme-option${theme.id === currentTheme.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setThemeId(theme.id)
                        setIsThemePickerOpen(false)
                      }}
                    >
                      <span
                        className="theme-swatch"
                        style={{ background: theme.swatch }}
                        aria-hidden="true"
                      />
                      <span className="theme-label">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {isAuthenticated ? (
            <>
              <span className="nav-user">Hello, {user?.name ?? 'User'}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  void handleLogout()
                }}
                disabled={logoutLoading}
              >
                {logoutLoading ? 'Logging out...' : 'Logout'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => openAuth('login')}
              >
                Login
              </button>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => openAuth('signup')}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/radar"
            element={
              <ProtectedRoute>
                <DiscoverPage />
              </ProtectedRoute>
            }
          />
          <Route path="/discover" element={<Navigate to="/radar" replace />} />
          <Route
            path="/simulate"
            element={
              <ProtectedRoute>
                <SimulatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulate/pools/:poolAddress"
            element={
              <ProtectedRoute>
                <PoolDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <div className="not-found">
                <h2>Page not found</h2>
                <p>Check the address or return to the simulation page.</p>
              </div>
            }
          />
        </Routes>
      </main>

      <footer className="app-footer">
        <span>© 2025 Pool Atlas</span>
        <div className="footer-links">
          <a href="#" onClick={(event) => event.preventDefault()}>
            Terms
          </a>
          <a href="#" onClick={(event) => event.preventDefault()}>
            Privacy
          </a>
        </div>
      </footer>

      <div className={`modal-overlay${authModal === 'login' || isForgotMode ? ' open' : ''}`} onClick={closeAuth}>
        <div className="modal-box" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="modal-close" onClick={closeAuth}>
            ✕
          </button>
          <div className="modal-brand">
            <div className="brand-logo modal-brand-logo">PA</div>
            <span className="modal-brand-name">Pool Atlas</span>
          </div>
          <h2 className="modal-title">{isForgotMode ? 'Recover password' : 'Welcome back'}</h2>
          <p className="modal-sub">
            {isForgotMode ? 'Enter your email to receive a reset link' : 'Sign in to your account'}
          </p>

          {isForgotMode ? (
            <>
              <form onSubmit={handleForgotSubmit}>
                <div className="modal-field">
                  <label className="inp-label" htmlFor="forgotEmail">
                    Email
                  </label>
                  <input
                    id="forgotEmail"
                    className="inp"
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    placeholder="you@example.com"
                    disabled={forgotLoading}
                  />
                </div>
                {forgotError ? <p className="auth-feedback auth-feedback-error">{forgotError}</p> : null}
                {forgotFeedback ? <p className="auth-feedback auth-feedback-success">{forgotFeedback}</p> : null}
                <button type="submit" className="btn btn-cta btn-full modal-submit" disabled={forgotLoading}>
                  {forgotLoading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <p className="modal-switch-copy">
                {'Remember your password? '}
                <button
                  type="button"
                  className="modal-switch-btn"
                  onClick={() => openAuth('login', authRedirectPath)}
                  disabled={forgotLoading}
                >
                  Back to sign in
                </button>
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-social"
                onClick={() => {
                  void handleGoogleAuth('login')
                }}
                disabled={loginBusy}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {loginGoogleLoading ? 'Connecting...' : 'Continue with Google'}
              </button>
              <div className="modal-or">
                <span>or</span>
              </div>
              <form onSubmit={handleLoginSubmit}>
                <div className="modal-field">
                  <label className="inp-label" htmlFor="loginEmail">
                    Email
                  </label>
                  <input
                    id="loginEmail"
                    className="inp"
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="you@example.com"
                    disabled={loginBusy}
                  />
                </div>
                <div className="modal-field">
                  <label className="inp-label" htmlFor="loginPwd">
                    Password
                  </label>
                  <div className="modal-pwd-wrap">
                    <input
                      id="loginPwd"
                      className="inp"
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="••••••••"
                      disabled={loginBusy}
                    />
                    <button
                      type="button"
                      className="modal-pwd-toggle"
                      onClick={() => setShowLoginPassword((current) => !current)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      disabled={loginBusy}
                    >
                      {showLoginPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <div className="modal-forgot-wrap">
                  <button
                    type="button"
                    className="modal-forgot-link modal-forgot-btn"
                    onClick={() => openAuth('forgot', authRedirectPath)}
                    disabled={loginBusy}
                  >
                    Forgot password?
                  </button>
                </div>
                {loginNotice ? <p className="auth-feedback auth-feedback-success">{loginNotice}</p> : null}
                {loginError ? <p className="auth-feedback auth-feedback-error">{loginError}</p> : null}
                <button type="submit" className="btn btn-cta btn-full modal-submit" disabled={loginBusy}>
                  {loginLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              <p className="modal-switch-copy">
                {"Don't have an account? "}
                <button
                  type="button"
                  className="modal-switch-btn"
                  onClick={() => openAuth('signup', authRedirectPath)}
                  disabled={loginBusy}
                >
                  Sign up free
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      <div
        className={`modal-overlay${authModal === 'signup' ? ' open' : ''}`}
        onClick={closeAuth}
      >
        <div className="modal-box" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="modal-close" onClick={closeAuth}>
            ✕
          </button>
          <div className="modal-brand">
            <div className="brand-logo modal-brand-logo">PA</div>
            <span className="modal-brand-name">Pool Atlas</span>
          </div>
          <h2 className="modal-title">Create account</h2>
          <p className="modal-sub">Start exploring and simulating pools for free</p>
          <button
            type="button"
            className="btn-social"
            onClick={() => {
              void handleGoogleAuth('signup')
            }}
            disabled={signupBusy}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {signupGoogleLoading ? 'Connecting...' : 'Sign up with Google'}
          </button>
          <div className="modal-or">
            <span>or</span>
          </div>
          <form onSubmit={handleSignupSubmit}>
            <div className="modal-field">
              <label className="inp-label" htmlFor="signupName">
                Full name
              </label>
              <input
                id="signupName"
                className="inp"
                type="text"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                placeholder="Your name"
                disabled={signupBusy}
              />
            </div>
            <div className="modal-field">
              <label className="inp-label" htmlFor="signupEmail">
                Email
              </label>
              <input
                id="signupEmail"
                className="inp"
                type="email"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={signupBusy}
              />
            </div>
            <div className="modal-field">
              <label className="inp-label" htmlFor="signupPwd">
                Password
              </label>
              <div className="modal-pwd-wrap">
                <input
                  id="signupPwd"
                  className="inp"
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={signupBusy}
                />
                <button
                  type="button"
                  className="modal-pwd-toggle"
                  onClick={() => setShowSignupPassword((current) => !current)}
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  disabled={signupBusy}
                >
                  {showSignupPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {signupError ? <p className="auth-feedback auth-feedback-error">{signupError}</p> : null}
            <button
              type="submit"
              className="btn btn-cta btn-full modal-submit modal-submit-signup"
              disabled={signupBusy}
            >
              {signupLoading ? 'Creating account...' : 'Create free account'}
            </button>
          </form>
          <p className="modal-terms-copy">
            By signing up you agree to our{' '}
            <a href="#" onClick={(event) => event.preventDefault()}>
              Terms
            </a>{' '}
            &amp;{' '}
            <a href="#" onClick={(event) => event.preventDefault()}>
              Privacy Policy
            </a>
          </p>
          <p className="modal-switch-copy">
            {'Already have an account? '}
            <button
              type="button"
              className="modal-switch-btn"
              onClick={() => openAuth('login', authRedirectPath)}
              disabled={signupBusy}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
