import { Link } from 'react-router-dom'
import './AdminAccessDenied.css'

export function AdminAccessDenied() {
  return (
    <section className="admin-access-denied">
      <div className="admin-access-denied__card">
        <div className="admin-access-denied__eyebrow">403</div>
        <h1>Access denied</h1>
        <p>You do not have permission to access the billing admin area.</p>
        <div className="admin-access-denied__actions">
          <Link className="btn btn-accent" to="/">
            Go home
          </Link>
          <Link className="btn btn-ghost" to="/pricing">
            View pricing
          </Link>
        </div>
      </div>
    </section>
  )
}
