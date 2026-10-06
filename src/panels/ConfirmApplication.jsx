import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

// The link in the "please confirm your email" message after applying for a place.
// Confirming sends the application to the school; the link works once.
export default function ConfirmApplication({ token, onDone }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return  // once, even when React runs effects twice in development
    sent.current = true
    api.confirmApplication(token).then(setResult).catch((err) => setError(err.message))
  }, [token])

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <LogoFull />
        <p className="tagline">Apply for a place</p>
        {!result && !error && <p className="text-muted">Confirming…</p>}
        {result && (
          <div className="success-banner" role="status">
            Thank you. Your email is confirmed and your application has been sent to {result.school}
            {' '}(reference {result.reference}). We have emailed you a copy, and the school will be in touch.
          </div>
        )}
        {error && <div className="error-banner" role="alert">{error}</div>}
        <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>
          <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={onDone}>Go to HouseMaster</button>
        </p>
      </div>
    </div>
  )
}
