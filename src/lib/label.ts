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
// Flush to the portrait's top edge so the QR hugs the left of the rotated
// (555×360) print image — no leading margin before the code.
const QR_TOP = 0
const QR_SIZE = PORTRAIT_WIDTH - SIDE_PAD * 2 // full-width QR
// Gap between the QR and the caption. Tightened from the original 28 so the text
// sits closer to the code.
const CAPTION_GAP = 12
const CAPTION_FONT_PX = 26
const CAPTION_LINE_PX = 32
const CAPTION_MAX_LINES = 7
// Underline thickness and how far below the text top it sits, in px.
const UNDERLINE_PX = 2
const UNDERLINE_OFFSET = CAPTION_FONT_PX + 1

/**
 * One run of caption text sharing a single style. Adjacent runs may differ in
 * weight/slant/underline; a caption is a list of paragraphs, each a list of
 * runs. This is what {@link renderPortrait} lays out and draws.
 */
export type StyledRun = {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
}

/** Rich caption: paragraphs (split on hard line breaks), each a list of runs. */
export type RichText = StyledRun[][]

export type LabelInput = {
  /** The QR payload — an intervals:// URI, a URL, or any text. */
  payload: string
  /**
   * Human-readable caption printed beneath the QR. Either a plain string or a
   * {@link RichText} carrying bold/italic/underline runs.
   */
  caption: string | RichText
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

  // Caption beneath the QR, centred, wrapped, and style-aware.
  const rich = normaliseCaption(caption)
  if (rich.length > 0) {
    // Make sure Inter is resident before measuring/drawing, or the wrap is
    // computed against a fallback face and shifts once the real font loads.
    try {
      await document.fonts.ready
    } catch {
      // Font Loading API unavailable — fall through and draw with whatever's up.
    }
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const maxWidth = PORTRAIT_WIDTH - SIDE_PAD * 2
    const lines: StyledRun[][] = []
    for (const paragraph of rich) {
      for (const line of wrapRuns(ctx, paragraph, maxWidth)) {
        lines.push(line)
        if (lines.length >= CAPTION_MAX_LINES) break
      }
      if (lines.length >= CAPTION_MAX_LINES) break
    }

    let y = QR_TOP + QR_SIZE + CAPTION_GAP
    for (const line of lines) {
      drawStyledLine(ctx, line, y, maxWidth)
      y += CAPTION_LINE_PX
    }
  }
}

/** Builds the caption font string for a given run style. */
function runFont(run: Pick<StyledRun, 'bold' | 'italic'>): string {
  const weight = run.bold ? 700 : 600
  const slant = run.italic ? 'italic ' : ''
  return `${slant}${weight} ${CAPTION_FONT_PX}px 'Inter Variable', Inter, system-ui, sans-serif`
}

/** Draws one wrapped line of styled runs, centred within `maxWidth`. */
function drawStyledLine(
  ctx: CanvasRenderingContext2D,
  runs: StyledRun[],
  y: number,
  maxWidth: number,
): void {
  let total = 0
  for (const run of runs) {
    ctx.font = runFont(run)
    total += ctx.measureText(run.text).width
  }
  let x = (PORTRAIT_WIDTH - Math.min(total, maxWidth)) / 2
  for (const run of runs) {
    ctx.font = runFont(run)
    const w = ctx.measureText(run.text).width
    ctx.fillText(run.text, x, y)
    if (run.underline && run.text.trim()) {
      ctx.fillRect(x, y + UNDERLINE_OFFSET, w, UNDERLINE_PX)
    }
    x += w
  }
}

/**
 * Rotates a portrait label into the landscape print frame and blanks the fixed
 * top margin. Returns a fresh {@link PRINT_WIDTH}×{@link PRINT_HEIGHT} canvas.
 *
 * The rotation is 270° clockwise (i.e. 90° counter-clockwise): the portrait's
 * top edge (the QR) lands on the left of the landscape bitmap. If your printer
 * expects the opposite feed direction, negate the angle here.
 */
export function toPrintCanvas(portrait: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = PRINT_WIDTH
  out.height = PRINT_HEIGHT
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PRINT_WIDTH, PRINT_HEIGHT)

  // 270° CW (90° CCW): translate to the bottom edge, rotate, then draw the
  // portrait at the origin. Portrait width (360) → print height (360); portrait
  // height (555) → print width (555), so it maps exactly onto the landscape
  // frame.
  ctx.save()
  ctx.translate(0, PRINT_HEIGHT)
  ctx.rotate(-Math.PI / 2)
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

/**
 * Greedy word-wrap of a paragraph's styled runs against `maxWidth`, measuring
 * each word in its own run's font. Words carry their style through the wrap so a
 * single run can span multiple lines and adjacent styles stay intact.
 */
function wrapRuns(
  ctx: CanvasRenderingContext2D,
  runs: StyledRun[],
  maxWidth: number,
): StyledRun[][] {
  // Tokenise into styled words (whitespace collapsed).
  const words: StyledRun[] = []
  for (const run of runs) {
    for (const w of run.text.split(/\s+/)) {
      if (w) words.push({ ...run, text: w })
    }
  }
  if (words.length === 0) return [[]]

  const lines: StyledRun[][] = []
  let line: StyledRun[] = []
  let lineWidth = 0
  for (const word of words) {
    ctx.font = runFont(word)
    const wordWidth = ctx.measureText(word.text).width
    const spaceWidth = line.length ? ctx.measureText(' ').width : 0
    if (line.length && lineWidth + spaceWidth + wordWidth > maxWidth) {
      lines.push(line)
      line = [{ ...word }]
      lineWidth = wordWidth
    } else {
      // Fold the leading space into the word so drawing stays a simple advance.
      line.push({ ...word, text: line.length ? ` ${word.text}` : word.text })
      lineWidth += spaceWidth + wordWidth
    }
  }
  if (line.length) lines.push(line)
  return lines
}

/** Wraps a plain caption string into a single unstyled {@link RichText}. */
export function plainToRichText(text: string): RichText {
  return text
    .split('\n')
    .map((para) => [{ text: para, bold: false, italic: false, underline: false }])
}

/**
 * Parses caption HTML (as produced by the rich-text editor's `contentEditable`)
 * into {@link RichText}. Recognises `<b>/<strong>`, `<i>/<em>`, `<u>`, and
 * treats `<br>` plus block elements (`<div>`, `<p>`) as hard line breaks.
 */
export function htmlToRichText(html: string): RichText {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const paragraphs: RichText = []
  let current: StyledRun[] = []

  const push = (text: string, style: Omit<StyledRun, 'text'>) => {
    if (text) current.push({ text, ...style })
  }
  const newline = () => {
    paragraphs.push(current)
    current = []
  }

  const walk = (node: Node, style: Omit<StyledRun, 'text'>) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        // A `pre-wrap` editor encodes hard breaks as literal newlines inside the
        // text node rather than <br>/<div>, so split on them.
        const parts = (child.textContent ?? '').split('\n')
        parts.forEach((part, i) => {
          if (i > 0) newline()
          push(part, style)
        })
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') {
        newline()
        continue
      }
      const isBlock = tag === 'div' || tag === 'p'
      // A block after existing content starts a fresh line.
      if (isBlock && (current.length > 0 || paragraphs.length > 0)) newline()
      const next = {
        bold: style.bold || tag === 'b' || tag === 'strong',
        italic: style.italic || tag === 'i' || tag === 'em',
        underline: style.underline || tag === 'u',
      }
      walk(el, next)
    }
  }

  walk(doc.body, { bold: false, italic: false, underline: false })
  paragraphs.push(current)
  return paragraphs
}

/** Flattens {@link RichText} back to a plain string (for the print payload). */
export function richTextToPlain(rich: RichText): string {
  return rich
    .map((para) => para.map((run) => run.text).join(''))
    .join('\n')
    .trim()
}

/** Coerces either caption form into {@link RichText}, dropping empty trailing runs. */
function normaliseCaption(caption: string | RichText): RichText {
  const rich = typeof caption === 'string' ? plainToRichText(caption) : caption
  // Drop paragraphs that hold no printable text so an empty editor renders nothing.
  const hasText = rich.some((para) => para.some((run) => run.text.trim()))
  return hasText ? rich : []
}
