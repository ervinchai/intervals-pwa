import { useEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/cn'
import {
  PORTRAIT_HEIGHT,
  PORTRAIT_WIDTH,
  renderPortrait,
  type LabelInput,
} from '@/lib/label'

/**
 * Extra white space shown above the label in the preview only, to visualise the
 * physical top bleed/feed margin. It does not change the printed image — the
 * label is rendered at its true {@link PORTRAIT_WIDTH}×{@link PORTRAIT_HEIGHT}
 * and blitted down by this much onto a slightly taller preview canvas.
 */
const PREVIEW_TOP_BLEED = 24

/**
 * Preview-only horizontal nudge, in px. The printed label pads its content 4px
 * toward +x (`CONTENT_X_OFFSET`) to clear the physical bottom bleed; on screen
 * that shift just looks off-centre, so we slide the composited label back left by
 * the same amount. Cosmetic only — the sent bitmap is unaffected.
 */
const PREVIEW_X_OFFSET = -2

/**
 * Live canvas preview of a label, rendered at `scale` of the portrait frame.
 * Shared by the Print authoring screen and the one-tap print dialog so both
 * show pixel-identical output to what gets sent to the printer (plus the
 * preview-only {@link PREVIEW_TOP_BLEED}).
 */
export function LabelPreview({
  label,
  scale = 0.5,
  className,
}: {
  label: LabelInput
  scale?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Re-render only when the label's content actually changes, not on every
  // parent render (a fresh object identity each time would thrash otherwise).
  const key = useMemo(() => JSON.stringify(label), [label])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Render the true label offscreen, then composite it below the bleed strip.
    const offscreen = document.createElement('canvas')
    void renderPortrait(offscreen, label)
      .then(() => {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(offscreen, PREVIEW_X_OFFSET, PREVIEW_TOP_BLEED)
      })
      .catch(() => {
        // A malformed payload (too long for the QR version) shouldn't crash the
        // view; the preview keeps its previous frame.
      })
    // `key` captures label content; `label` itself is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const height = PORTRAIT_HEIGHT + PREVIEW_TOP_BLEED
  return (
    <canvas
      ref={canvasRef}
      width={PORTRAIT_WIDTH}
      height={height}
      className={cn('rounded-card border border-line shadow-sm', className)}
      style={{ width: PORTRAIT_WIDTH * scale, height: height * scale }}
    />
  )
}
