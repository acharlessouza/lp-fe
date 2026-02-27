import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import DiscoverPage from './pages/DiscoverPage'
import PoolDetailPage from './pages/PoolDetailPage'
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
  const isDiscoverRoute = location.pathname.startsWith('/discover')
  const isSimulateRoute = location.pathname.startsWith('/simulate')
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false)
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
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="app">
      <header className="nav">
        <Link className="brand" to="/simulate" aria-label="Pool Atlas">
          <span className="brand-logo" aria-hidden="true">
            PA
          </span>
          <span className="brand-name">Pool Atlas</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link className={`nl${isDiscoverRoute ? ' active' : ''}`} to="/discover">
            Discover
          </Link>
          <Link className={`nl${isSimulateRoute ? ' active' : ''}`} to="/simulate">
            Simulate
          </Link>
          <a className="nl dis" href="#" aria-disabled="true" onClick={(event) => event.preventDefault()}>
            Track
          </a>
          <a className="nl dis" href="#" aria-disabled="true" onClick={(event) => event.preventDefault()}>
            Pricing
          </a>
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
          <button type="button" className="btn btn-ghost btn-sm">
            Login
          </button>
          <button type="button" className="btn btn-accent btn-sm">
            Start Free
          </button>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/simulate" replace />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/simulate" element={<SimulatePage />} />
          <Route path="/simulate/pools/:poolAddress" element={<PoolDetailPage />} />
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
    </div>
  )
}

export default App
