import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resetPassword } from '../auth/authApi'

function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const search = new URLSearchParams(location.search)
  const token = search.get('token')?.trim() ?? ''

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!token) {
      setError('Invalid or missing reset token.')
      return
    }

    if (!password.trim()) {
      setError('Please enter a new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      navigate('/', {
        replace: true,
        state: {
          openAuth: 'login',
          authNotice: 'Password updated. Please sign in.',
        },
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="public-page">
      <h1>Reset your password</h1>
      <p>Create a new password to continue using your account.</p>

      {!token ? (
        <p className="auth-feedback auth-feedback-error" style={{ marginTop: 14 }}>
          Invalid or expired reset link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
          <div className="modal-field">
            <label className="inp-label" htmlFor="resetPassword">
              New password
            </label>
            <input
              id="resetPassword"
              className="inp"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a new password"
              disabled={loading}
            />
          </div>
          <div className="modal-field">
            <label className="inp-label" htmlFor="resetConfirmPassword">
              Confirm password
            </label>
            <input
              id="resetConfirmPassword"
              className="inp"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat the new password"
              disabled={loading}
            />
          </div>
          {error ? <p className="auth-feedback auth-feedback-error">{error}</p> : null}
          <div className="public-page-actions">
            <button type="submit" className="btn btn-cta" disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
            <Link className="btn btn-ghost" to="/">
              Back to home
            </Link>
          </div>
        </form>
      )}
    </section>
  )
}

export default ResetPasswordPage
