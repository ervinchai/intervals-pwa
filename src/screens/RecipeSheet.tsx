import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'

import { Badge, Heading, Row, Spacer, Stack, Text } from '@/components/ui'
import type { BrewLogEntry, BrewResult } from '@/lib/contracts'

/**
 * The target-recipe card as a bottom sheet — pulled up to read at a glance while
 * dialing in, then dismissed. A sheet rather than a centered dialog: on the wall
 * panel it stays within thumb reach and doesn't yank focus to the middle. Tap the
 * backdrop or the handle (or press Escape) to close.
 *
 * Content is deliberately just the numbers that matter — method, grind, the
 * dose→yield with its ratio, time and temp — plus the adjustment note if the
 * brew carried one.
 */
export function RecipeSheet({
  brew,
  beanName,
  open,
  onClose,
}: {
  brew: BrewLogEntry | null
  beanName: string
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && brew && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100vh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeInOut' }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-label={`Target recipe for ${beanName}`}
        >
          <motion.div
            className="w-full max-w-[560px] rounded-t-[22px] bg-base px-7 pb-8 pt-3 shadow-lg"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="mx-auto mb-4 block h-1.5 w-11 rounded-full bg-line"
            />

            <Row gap="sm" align="baseline">
              <Stack gap="none" className="min-w-0">
                <Heading role="label" as="span" tone="faint">
                  Target recipe
                </Heading>
                <Heading role="title" className="min-w-0">
                  {beanName}
                </Heading>
              </Stack>
              <Spacer />
              <Badge>{brew.method}</Badge>
            </Row>

            <Row gap="xl" align="baseline" className="mt-6 flex-wrap">
              <Stat label="grind" value={brew.grind} />
              <Stat label="dose" value={num(brew.doseG, 'g')} />
              <Stat label="yield" value={num(brew.yieldG, 'g')} />
              <Stat label="ratio" value={brew.ratio != null ? `1:${brew.ratio}` : undefined} accent />
              <Stat label="time" value={num(brew.timeS, 's')} />
              <Stat label="temp" value={num(brew.waterTempC, '°')} />
            </Row>

            {(brew.result || brew.adjustment || brew.notes) && (
              <Stack gap="sm" className="mt-6 border-t border-line pt-4">
                {brew.result ? (
                  <Row gap="sm" align="center">
                    <Text size="sm" tone="faint">Result</Text>
                    <Badge tone={resultTone(brew.result)}>{brew.result}</Badge>
                  </Row>
                ) : null}
                {brew.adjustment ? (
                  <Text size="sm" tone="dim">→ {brew.adjustment}</Text>
                ) : null}
                {brew.notes ? (
                  <Text size="sm" tone="dim">{brew.notes}</Text>
                ) : null}
              </Stack>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** One big glanceable number with its unit baked in and a faint caption under it. */
function Stat({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  if (!value) return null
  return (
    <Stack gap="none">
      <span
        className="text-[2rem] font-semibold leading-none tabular-nums"
        style={{ color: accent ? 'var(--color-ember)' : 'var(--color-ink)' }}
      >
        {value}
      </span>
      <Text size="xs" tone="faint">{label}</Text>
    </Stack>
  )
}

function num(v: number | undefined, unit: string): string | undefined {
  return v != null ? `${v}${unit}` : undefined
}

function resultTone(result: BrewResult | undefined): 'sage' | 'clay' | 'neutral' {
  if (result === 'Balanced') return 'sage'
  if (result === 'Bitter / Over') return 'clay'
  return 'neutral'
}
