import { useCallback, useRef, useState } from 'react'

import { fetchPrinterStatus, printLabel } from '@/lib/data'
import { renderLabelBase64, type LabelInput } from '@/lib/label'

/**
 * The lifecycle of a single print request.
 *
 * A print is really two steps — the printer connects over Bluetooth, then it
 * prints — but the backend call blocks until the whole job finishes, so it can't
 * report that handoff. We surface it by polling the printer's connectivity
 * ({@link fetchPrinterStatus}) while the print runs: `connecting` until the
 * printer reports connected, then `printing` until the job resolves.
 */
export type PrintState = 'idle' | 'connecting' | 'printing' | 'sent' | 'error'

/** How often connectivity is polled while a print is in flight. */
export const PRINT_POLL_MS = 800

/**
 * The reusable print behaviour: renders a {@link LabelInput} to a bitmap and
 * sends it to the printer, exposing the
 * `idle → connecting → printing → sent | error` state machine. Any view can
 * drive the shared print UI from this — the screen's authoring form and a
 * one-tap "print this bean" menu item use the same hook.
 *
 * The flow does not close itself — it settles on `sent` or `error` and stays
 * there until the consumer calls {@link dismiss} (typically when the user
 * acknowledges the status popup). Concurrent calls are ignored while a request
 * is in flight.
 */
export function usePrintFlow() {
  const [state, setState] = useState<PrintState>('idle')
  const busyRef = useRef(false)

  const print = useCallback(async (input: LabelInput) => {
    if (busyRef.current) return
    busyRef.current = true
    setState('connecting')

    // Poll connectivity alongside the blocking print. Once the printer reports
    // connected, advance to `printing`; the loop then idles until the print
    // settles (`settled`), so a lost connection mid-job doesn't rewind the UI.
    let settled = false
    const watchConnection = async () => {
      let connected = false
      while (!settled) {
        try {
          connected = connected || (await fetchPrinterStatus()).connected
        } catch {
          // A failed status read shouldn't abort the print — keep polling.
        }
        if (connected) setState((s) => (s === 'connecting' ? 'printing' : s))
        if (settled) break
        await new Promise((r) => setTimeout(r, PRINT_POLL_MS))
      }
    }
    void watchConnection()

    let ok = false
    try {
      const imageBase64 = await renderLabelBase64(input)
      ok = (await printLabel({ imageBase64 })).ok
    } catch {
      ok = false
    }

    settled = true
    busyRef.current = false
    setState(ok ? 'sent' : 'error')
  }, [])

  const dismiss = useCallback(() => setState('idle'), [])

  return { state, print, dismiss }
}
