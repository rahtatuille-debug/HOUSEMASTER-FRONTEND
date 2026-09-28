// Shown instead of a blank white page if a render error escapes the app.
// The error is reported to Sentry (when configured) by the boundary itself.
export default function CrashFallback() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Something went wrong</h1>
        <p className="tagline">
          HouseMaster hit an unexpected error. Reloading the page usually fixes it.
        </p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  )
}
