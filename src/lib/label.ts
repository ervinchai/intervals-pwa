import QRCode from 'qrcode'

/**
 * QR label rendering.
 *
 * The label is *designed* portrait — 360×555, QR full-width on top with a
 * caption beneath — because that is how it is read once stuck on a bag. The
 * printer, however, wants the bitmap landscape: {@link PRINT_WIDTH}×
 * {@link PRINT_HEIGHT}, rotated 90°, with the first {@link TOP_MARGIN}px left
 * blank as a fixed feed margin. So there are two frames here: the portrait
 * canvas we show the user, and the landscape canvas we hand to the printer /
 * encode to base64. {@link toPrintCanvas} is the bridge between them.
 */

/** Portrait design frame — what the user sees and reads. */
export const PORTRAIT_WIDTH = 360
export const PORTRAIT_HEIGHT = 555

/** Landscape print frame — what actually gets sent to the printer. */
export const PRINT_WIDTH = 555
export const PRINT_HEIGHT = 360

/**
 * Fixed blank margin along the top of the *sent* (landscape) image. The printer
 * eats these rows as a feed margin, so nothing may be drawn there — we force
 * them white after rotation regardless of layout.
 */
export const TOP_MARGIN = 4

/** Padding inside the portrait frame so content clears the label edges. */
const SIDE_PAD = 24
const QR_TOP = 32
const QR_SIZE = PORTRAIT_WIDTH - SIDE_PAD * 2 // full-width QR
const CAPTION_GAP = 28
const CAPTION_FONT_PX = 26
const CAPTION_LINE_PX = 32
const CAPTION_MAX_LINES = 6

export type LabelInput = {
  /** The QR payload — an intervals:// URI, a URL, or any text. */
  payload: string
  /** Human-readable caption printed beneath the QR. */
  caption: string
}

/**
 * Draws the portrait label into `canvas` (sized to the portrait frame). This is
 * the on-screen preview and the source bitmap for {@link toPrintCanvas}.
 *
 * Async because the QR is rendered to an offscreen canvas by the `qrcode`
 * library, and because we wait on `document.fonts` so the caption is drawn in
 * Inter rather than a fallback that would reflow the wrap.
 */
export async function renderPortrait(
  canvas: HTMLCanvasElement,
  { payload, caption }: LabelInput,
): Promise<void> {
  canvas.width = PORTRAIT_WIDTH
  canvas.height = PORTRAIT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  // White ground across the whole label.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT)

  // QR block, full width across the top. An empty payload leaves the QR area
  // blank rather than throwing — the caller gates the copy button on payload.
  if (payload) {
    const qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, payload, {
      width: QR_SIZE,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
    ctx.drawImage(qr, SIDE_PAD, QR_TOP, QR_SIZE, QR_SIZE)
  }

  // Caption beneath the QR, centred and wrapped.
  const text = caption.trim()
  if (text) {
    // Make sure Inter is resident before measuring/drawing, or the wrap is
    // computed against a fallback face and shifts once the real font loads.
    try {
      await document.fonts.ready
    } catch {
      // Font Loading API unavailable — fall through and draw with whatever's up.
    }
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = `600 ${CAPTION_FONT_PX}px 'Inter Variable', Inter, system-ui, sans-serif`

    const maxWidth = PORTRAIT_WIDTH - SIDE_PAD * 2
    const lines = wrapText(ctx, text, maxWidth).slice(0, CAPTION_MAX_LINES)
    let y = QR_TOP + QR_SIZE + CAPTION_GAP
    for (const line of lines) {
      ctx.fillText(line, PORTRAIT_WIDTH / 2, y)
      y += CAPTION_LINE_PX
    }
  }
}

/**
 * Rotates a portrait label into the landscape print frame and blanks the fixed
 * top margin. Returns a fresh {@link PRINT_WIDTH}×{@link PRINT_HEIGHT} canvas.
 *
 * The rotation is 90° clockwise: the portrait's top edge (the QR) lands on the
 * right of the landscape bitmap. If your printer expects the opposite feed
 * direction, negate the angle here.
 */
export function toPrintCanvas(portrait: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = PRINT_WIDTH
  out.height = PRINT_HEIGHT
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PRINT_WIDTH, PRINT_HEIGHT)

  // 90° CW: translate to the right edge, rotate, then draw the portrait at the
  // origin. Portrait width (360) → print height (360); portrait height (555) →
  // print width (555), so it maps exactly onto the landscape frame.
  ctx.save()
  ctx.translate(PRINT_WIDTH, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(portrait, 0, 0)
  ctx.restore()

  // Force the fixed feed margin blank on the *sent* image, whatever the rotation
  // mapped there.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PRINT_WIDTH, TOP_MARGIN)

  return out
}

/**
 * PNG of a canvas as raw base64 (no `data:` prefix) — the form a print backend
 * typically wants. Prefix it with `data:image/png;base64,` to use in an `<img>`.
 */
export function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
}

/** Greedy word-wrap against the current canvas font, honouring explicit \n. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = words[0]
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${line} ${words[i]}`
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
      } else {
        lines.push(line)
        line = words[i]
      }
    }
    lines.push(line)
  }
  return lines
}
