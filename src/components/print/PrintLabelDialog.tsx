import { Printer, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback } from 'react'

import { Button, Heading, Row } from '@/components/ui'
import type { LabelInput } from '@/lib/label'

import { LabelPreview } from './LabelPreview'
import { PrintStatusPopup } from './PrintStatusPopup'
import { usePrintFlow } from './usePrintFlow'

/**
 * A drop-in "print this label" prompt for any view. Given a prebuilt
 * {@link LabelInput} — the QR payload and its rich caption, assembled by the
 * calling view so each view controls its own label layout — it shows a preview
 * with Print / Cancel, then layers the live print status on top of it.
 *
 * The preview popup persists from the confirm step through the whole print: it
 * never disappears while printing. Clicking Print raises a second, higher popup
 * ({@link PrintStatusPopup}) over the preview — a spinner, then a "Printed" tick
 * or an error. Both wait for a tap: acknowledging a success closes the whole
 * dialog; dismissing an error just drops back to the preview, where the user can
 * simply press Print again (so the status popup needs no retry button of its own).
 *
 * Mount it unconditionally and drive it with `open`/`onClose`:
 *
 * ```tsx
 * const [printing, setPrinting] = useState(false)
 * <Button onClick={() => setPrinting(true)}>Print label</Button>
 * <PrintLabelDialog
 *   label={beanLabel(bean)}
 *   open={printing}
 *   onClose={() => setPrinting(false)}
 * />
 * ```
 */
export function PrintLabelDialog({
  label,
  open,
  onClose,
  title = 'Print label',
}: {
  label: LabelInput
  open: boolean
  onClose: () => void
  title?: string
}) {
  const { state, print, dismiss } = usePrintFlow()

  // Reset the flow and close together, so `open` and the print state flip in one
  // batch — nothing flashes on the way out.
  const close = useCallback(() => {
    dismiss()
    onClose()
  }, [dismiss, onClose])

  // Tapping the status popup: a success is "done", so close the whole dialog; an
  // error just clears the status back to the preview, ready to print again.
  const dismissStatus = useCallback(() => {
    if (state === 'sent') close()
    else dismiss()
  }, [state, close, dismiss])

  return (
    <>
      {/* Preview layer — stays up for the whole flow, dimmed behind the status
          popup while a print is in flight. */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-8"
            // Bleed the dim past the layout-viewport bottom into the iOS
            // home-indicator safe area, then pad the content back off it — a
            // plain `bottom: 0` fixed element stops short of the physical screen
            // in standalone, leaving an un-dimmed strip. See PrintStatusPopup.
            style={{
              bottom: 'calc(-1 * env(safe-area-inset-bottom))',
              paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            role="dialog"
            aria-modal
          >
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-card bg-base/95 p-6 text-center shadow-lg">
              <Heading role="label" as="span">
                {title}
              </Heading>
              <LabelPreview label={label} />
              <Row gap="sm" className="w-full">
                <Button variant="secondary" onClick={close} full>
                  <X className="h-5 w-5" />
                  Cancel
                </Button>
                <Button onClick={() => void print(label)} full>
                  <Printer className="h-5 w-5" />
                  Print
                </Button>
              </Row>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status layer — self-hides while idle, sits above the preview otherwise.
          Tapping a success closes the dialog; tapping an error returns here. */}
      <PrintStatusPopup state={state} onDismiss={dismissStatus} />
    </>
  )
}
