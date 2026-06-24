// Sprint 15 — helper pra enviar erro client-side pro endpoint
// /api/client-error-report com fire-and-forget. Sem await (não bloqueia o
// fluxo de error boundary / handlers).

interface ReportInput {
  context: string
  error?: unknown
  digest?: string
  componentStack?: string
  extra?: Record<string, unknown>
}

export function reportClientError({ context, error, digest, componentStack, extra }: ReportInput): void {
  try {
    let message = ''
    let stack: string | undefined

    if (error instanceof Error) {
      message = error.message
      stack = error.stack
    } else if (typeof error === 'string') {
      message = error
    } else if (error != null) {
      try {
        message = JSON.stringify(error).slice(0, 2000)
      } catch {
        message = String(error)
      }
    }

    if (extra) {
      try {
        message = `${message}\nextra=${JSON.stringify(extra).slice(0, 2000)}`
      } catch {
        // ignore
      }
    }

    const payload = {
      context,
      message,
      stack,
      digest,
      componentStack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString(),
    }

    // fire-and-forget: usa sendBeacon se possível (sobrevive navigation),
    // senão fetch normal sem await.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
        navigator.sendBeacon('/api/client-error-report', blob)
        return
      } catch {
        // cai pro fetch
      }
    }

    void fetch('/api/client-error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      // silencia — best-effort
    })
  } catch {
    // qualquer erro no próprio reporter é silenciado pra não causar loop
  }
}
