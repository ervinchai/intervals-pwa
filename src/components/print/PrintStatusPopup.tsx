import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { Text } from '@/components/ui'

import { PrintStatusContent } from './PrintStatusContent'
import { type PrintState } from './usePrintFlow'

/**
 * Print-status overlay. One backdrop fades in while a request is in flight and
 * stays put across connecting → printing → printed | error; only the inner
 * content cross-fades between states.
 *
 * In-progress states (connecting/printing) can't be dismissed. A terminal state
 * (printed or error) waits for the user — tapping anywhere calls `onDismiss`. It
 * never closes itself, so a successful print stays on screen until acknowledged,
 * and an error simply drops back to whatever's underneath (the print dialog's
 * preview, where the user can re-print) rather than needing its own retry button.
 */
export function PrintStatusPopup({
  state,
  onDismiss,
}: {
  state: PrintState
  onDismiss: () => void
}) {
  const open = state !== 'idle'
  // Hold the last non-idle state so content stays rendered through the backdrop
  // fade-out instead of blanking the instant we return to idle.
  const [shown, setShown] = useState<Exclude<PrintState, 'idle'>>('connecting')
  useEffect(() => {
    if (state !== 'idle') setShown(state)
  }, [state])

  // Only a settled print is dismissible; a tap mid-print must not cancel it.
  const terminal = shown === 'sent' || shown === 'error'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          role={shown === 'error' ? 'alertdialog' : 'status'}
          aria-modal={shown === 'error' || undefined}
          onClick={terminal ? onDismiss : undefined}
        >
          <div className="flex w-80 flex-col items-center gap-4 rounded-card bg-base/95 px-8 py-6 shadow-lg">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={shown}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="flex flex-col items-center gap-4"
              >
                <PrintStatusContent state={shown} />
                {terminal && (
                  <Text tone="faint" className="text-sm">
                    Tap anywhere to dismiss
                  </Text>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
