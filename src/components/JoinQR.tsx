import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

type Props = {
  /** The URL players should land on. */
  url: string
  /** Module size in px; the SVG scales to whatever the layout gives it. */
  size?: number
}

/**
 * QR code for the buzzer link, drawn as inline SVG.
 *
 * Generated in the browser rather than fetched from a QR service: the Worker
 * serves everything itself, and an external image would be one more thing to
 * fail in a room full of phones.
 *
 * Rendered dark-on-light inside a pale panel. Inverting it to suit the dark UI
 * would look neater and scan worse — plenty of phone cameras refuse light-on-dark
 * codes, and this has one job.
 */
export function JoinQR({ url, size = 152 }: Props) {
  const { path, count } = useMemo(() => {
    // Type 0 = pick the smallest version that fits. 'M' tolerates ~15% damage,
    // which is the usual choice for a code read off a screen.
    const qr = qrcode(0, 'M')
    qr.addData(url)
    qr.make()

    const n = qr.getModuleCount()
    let d = ''
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`
      }
    }
    return { path: d, count: n }
  }, [url])

  // 2-module quiet zone on each side, which scanners expect.
  const quiet = 2
  const box = count + quiet * 2

  return (
    <div className="joinqr">
      <div className="joinqr-panel" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${box} ${box}`}
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
          role="img"
          aria-label={`QR code for ${url}`}
        >
          <g transform={`translate(${quiet} ${quiet})`} fill="#14120F">
            <path d={path} />
          </g>
        </svg>
      </div>
      <div className="joinqr-url">{url.replace(/^https?:\/\//, '')}</div>
    </div>
  )
}
