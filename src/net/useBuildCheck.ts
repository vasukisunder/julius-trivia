import { useEffect, useState } from 'react'

/**
 * Notices when this page is running an older build than the server is serving.
 *
 * Worth the code because it has caused two false bug reports already: the shared
 * screen kept running stale JavaScript after a deploy, and the mismatch looks
 * exactly like a rendering bug — one window showing the new design, the other the
 * old one, with no clue why.
 *
 * Works by comparing the hashed bundle this page loaded against the one the
 * server currently references. No build-time plumbing, and nothing to keep in
 * sync.
 */
const CHECK_MS = 45_000

function currentBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
  return el ? new URL(el.src).pathname : null
}

export function useBuildCheck(): boolean {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const mine = currentBundle()
    // In dev the entry is /src/main.tsx and never changes; HMR covers that case.
    if (!mine) return

    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
        const html = await res.text()
        const match = html.match(/src="(\/assets\/[^"]+\.js)"/)
        if (!cancelled && match && match[1] !== mine) setStale(true)
      } catch {
        // Offline or the server is down; the connection badge covers that.
      }
    }

    check()
    const id = window.setInterval(check, CHECK_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return stale
}
