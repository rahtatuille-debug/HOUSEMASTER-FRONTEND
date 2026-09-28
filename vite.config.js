import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// A production deploy must know where the API is. Without VITE_API_BASE_URL
// the app would quietly call http://127.0.0.1:8001 from every visitor's
// browser, so a Vercel production build stops here instead. Preview builds
// and local development are left alone.
export function checkProductionEnv(env, vercelEnv, warn = console.warn) {
  if (vercelEnv !== 'production') return
  if (!env.VITE_API_BASE_URL) {
    throw new Error(
      'VITE_API_BASE_URL is not set for this production build. Set it in Vercel → Settings → ' +
        'Environment Variables (Production) to the backend URL, then redeploy.',
    )
  }
  if (!env.VITE_SENTRY_DSN) {
    warn('Warning: VITE_SENTRY_DSN is not set, so frontend errors in production will not be reported.')
  }
}

export default defineConfig(({ mode }) => {
  checkProductionEnv(loadEnv(mode, process.cwd(), 'VITE_'), process.env.VERCEL_ENV)
  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
    },
  }
})
