import { useCallback, useRef, useState } from 'react'

import type { PrintReason } from '@/lib/contracts'
import { printLabel } from '@/lib/data'
import { renderLabelBase64, type LabelInput } from '@/lib/label'

/**
 * The lifecycle of a single print request.
 *
 * A print is really two steps — the printer connects over Bluetooth, then it
 * prints. The backend streams both as they happen ({@link printLabel}), so the
 * state follows the server: `connecting` until it reports `printing`, then
 * `sent` or `error`.
 */
export type PrintState = 'idle' | 'connecting' | 'printing' | 'sent' | 'error'

/**
 * The reusable print behaviour: renders a {@link LabelInput} to a bitmap and
 * sends it to the printer, exposing the
 * `idle → connecting → printing → sent | error` state machine. Any view can
 * drive the shared print UI from this — the screen's authoring form and a
 * one-tap "print this bean" menu item use the same hook.
 *
 * The flow does not close itself — it settles on `sent` or `error` and stays
 * there until the consumer calls {@link dismiss} (typically when the user
 * acknowledges the status popup). On `error`, `reason` says why, for a friendly
 * message. Concurrent calls are ignored while a request is in flight.
 */
export function usePrintFlow() {
  const [state, setState] = useState<PrintState>('idle')
  const [reason, setReason] = useState<PrintReason | null>(null)
  const busyRef = useRef(false)

  const print = useCallback(async (input: LabelInput) => {
    if (busyRef.current) return
    busyRef.current = true
    setReason(null)
    setState('connecting')

    let failure: PrintReason | null = null
    try {
      const imageBase64 = await renderLabelBase64(input)
      const outcome = await printLabel({ imageBase64 }, setState)
      if (!outcome.ok) failure = outcome.reason
    } catch {
      failure = 'service_unavailable'
    }

    busyRef.current = false
    setReason(failure)
    setState(failure ? 'error' : 'sent')
  }, [])

  const dismiss = useCallback(() => setState('idle'), [])

  return { state, reason, print, dismiss }
}
