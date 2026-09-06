import { Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button, Heading, Input, Row, Stack, Text } from '@/components/ui'
import {
  canvasToBase64,
  PORTRAIT_HEIGHT,
  PORTRAIT_WIDTH,
  renderPortrait,
  toPrintCanvas,
} from '@/lib/label'

// How long the "Copied" confirmation stays up before reverting the button.
const COPIED_MS = 1500

/**
 * QR label maker. The user types a payload (an `intervals://` URI, a URL, or any
 * text) and a caption; we render a portrait label — QR full-width on top,
 * caption beneath — and preview it live. The exported bitmap is landscape
 * (555×360, rotated, top margin blanked) as the printer requires, and the copy
 * button puts its PNG base64 on the clipboard.
 *
 * Rendering runs against a real <canvas> rather than SVG/DOM so the pixels we
 * preview are exactly the pixels we encode — there is no second rasterisation
 * path that could drift from what the user sees.
 */
export function Print() {
  const [payload, setPayload] = useState('')
  const [caption, setCaption] = useState('')
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Re-render the preview whenever the inputs change.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    void renderPortrait(canvas, { payload, caption }).catch(() => {
      // A malformed payload (e.g. too long for the QR version) shouldn't crash
      // the screen; the preview simply keeps its previous frame.
    })
  }, [payload, caption])

  const copyBase64 = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !payload) return
    const base64 = canvasToBase64(toPrintCanvas(canvas))
    try {
      await navigator.clipboard.writeText(base64)
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Clipboard blocked (insecure context / permissions) — leave the button
      // as-is rather than falsely confirming.
    }
  }, [payload])

  return (
    <Stack gap="lg" className="h-full">
      <Row>
        <Heading role="hero" level={1}>
          Print
        </Heading>
      </Row>

      <div className="flex min-h-0 flex-1 gap-8">
        {/* Controls */}
        <Stack gap="md" className="w-full max-w-sm">
          <Stack gap="sm">
            <Heading role="label" as="span">
              QR content
            </Heading>
            <Input
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="intervals://bean/… or any URL / text"
            />
          </Stack>

          <Stack gap="sm">
            <Heading role="label" as="span">
              Caption
            </Heading>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Printed beneath the code"
            />
          </Stack>

          <Button onClick={copyBase64} disabled={!payload} full>
            {copied ? (
              <>
                <Check className="h-5 w-5" />
                Copied 555×360 base64
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Copy base64
              </>
            )}
          </Button>

          <Text tone="faint">
            Preview is the vertical label. The copied PNG is the rotated
            555×360 print image, with the top 4px left blank.
          </Text>
        </Stack>

        {/* Live preview — the portrait label at half scale. */}
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
          <canvas
            ref={canvasRef}
            width={PORTRAIT_WIDTH}
            height={PORTRAIT_HEIGHT}
            className="rounded-card border border-line shadow-sm"
            style={{
              width: PORTRAIT_WIDTH / 2,
              height: PORTRAIT_HEIGHT / 2,
            }}
          />
        </div>
      </div>
    </Stack>
  )
}
