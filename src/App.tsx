import { Link, Navigate, Route, Routes } from 'react-router-dom'
import DiscoverPage from './pages/DiscoverPage'
import PoolDetailPage from './pages/PoolDetailPage'
import SimulatePage from './pages/SimulatePage'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand-title">Pool Atlas</p>
            <p className="brand-subtitle">Liquidity discovery workspace</p>
          </div>
        </div>
        <nav className="main-nav" aria-label="Primary">
          <Link className="nav-link" to="/discover">
            Discover
          </Link>
          <Link className="nav-link" to="/simulate">
            Simulate
          </Link>
          <a className="nav-link disabled" href="#" aria-disabled="true">
            Track
          </a>
          <a className="nav-link disabled" href="#" aria-disabled="true">
            Pricing
          </a>
        </nav>
        <div className="header-meta">
          <span className="status-pill">Simulate APR</span>
        </div>
      </header>
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
    </div>
  )
}

export default App
