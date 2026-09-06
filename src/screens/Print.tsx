import { Check, Copy, Printer } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { RichCaptionEditor } from '@/components/RichCaptionEditor'
import {
  LabelPreview,
  PrintStatusPopup,
  usePrintFlow,
} from '@/components/print'
import { Button, Heading, Input, Row, Stack, Text } from '@/components/ui'
import { htmlToRichText, renderLabelBase64, type LabelInput } from '@/lib/label'

// How long the "Copied" confirmation stays up before reverting the button.
const COPIED_MS = 1500

/**
 * QR label maker. The user types a payload (an `intervals://` URI, a URL, or any
 * text) and a rich caption; we render a portrait label — QR full-width on top,
 * caption beneath — and preview it live.
 *
 * This screen is the free-form authoring surface. Views that already know their
 * content (e.g. a coffee bean) skip the fields and open
 * {@link PrintLabelDialog} with a prebuilt label instead — both drive the same
 * {@link usePrintFlow} + {@link PrintStatusPopup}.
 */
export function Print() {
  const [payload, setPayload] = useState('')
  // Caption is rich text, stored as the editor's raw HTML.
  const [captionHtml, setCaptionHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const { state, print, dismiss } = usePrintFlow()

  const label = useMemo<LabelInput>(
    () => ({ payload, caption: htmlToRichText(captionHtml) }),
    [payload, captionHtml],
  )

  const copyBase64 = useCallback(async () => {
    if (!payload) return
    try {
      const base64 = await renderLabelBase64(label)
      await navigator.clipboard.writeText(base64)
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      // Clipboard blocked (insecure context / permissions) or a render error —
      // leave the button as-is rather than falsely confirming.
    }
  }, [payload, label])

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
            <RichCaptionEditor
              value={captionHtml}
              onChange={setCaptionHtml}
              placeholder="Printed beneath the code — up to 7 lines"
            />
          </Stack>

          <Button
            onClick={() => void print(label)}
            disabled={!payload || state === 'connecting' || state === 'printing'}
            full
          >
            <Printer className="h-5 w-5" />
            Print
          </Button>

          <Button variant="secondary" onClick={copyBase64} disabled={!payload} full>
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
          <LabelPreview label={label} />
        </div>
      </div>

      <PrintStatusPopup state={state} onDismiss={dismiss} />
    </Stack>
  )
}
