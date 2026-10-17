import { Check, Pencil, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { FlowTrace, type Trace } from '@/components/shot/FlowTrace'
import { StopCard, type Cue } from '@/components/shot/StopCard'
import { Button, Card, Heading, Row, Spacer, Stack, Text } from '@/components/ui'
import type { ShotResult } from '@/app/router'
import type { BrewResult } from '@/lib/contracts'
import { formatShotClock } from '@/lib/coffee-utils'
import { targetState } from '@/lib/flow'

/** The top of the flow graph, in g/s: the same scale as on the pull. */
const TRACE_MAX_FLOW = 3

/** The one-tap taste: the three results the brew log keeps, with short labels for the buttons. */
const TASTES: Array<{ value: BrewResult; label: string }> = [
  { value: 'Sour / Under', label: 'Sour' },
  { value: 'Balanced', label: 'Balanced' },
  { value: 'Bitter / Over', label: 'Bitter' },
]

/** How long Discard waits for its second tap, in milliseconds, before it goes back to asking. */
const DISCARD_CONFIRM_MS = 3000

/**
 * The shot at a glance, always shown after the pull, by scale or by hand: how it landed against the target,
 * its numbers, and the flow over the shot when the scale read it. The actions sit right under the cards:
 * Save (the brew as it is, the main way out), Rate (a second screen, for the cup profile and notes), Edit
 * (the numbers, on the by-hand pull) and Discard (nothing is logged; a first tap turns it into "Sure?", as the
 * shot cannot be pulled again). They are one row of large, equal buttons for the touch screen.
 */
export function OverviewStep({
  shot,
  trace,
  traceOrigin,
  saving,
  error,
  onEdit,
  onRate,
  onTaste,
  onSave,
  onDiscard,
}: {
  shot: ShotResult
  /** The flow over the whole shot, when the scale read it. */
  trace?: Trace | null
  /** When the shot timer started, on the trace's clock, for its time marks. */
  traceOrigin?: number | null
  saving: boolean
  error: string | null
  onEdit: () => void
  onRate: () => void
  /** Pick how the shot tasted (the same again clears it); it is saved as the brew's result. */
  onTaste: (taste: BrewResult) => void
  onSave: () => void
  /** Leave without logging the shot. */
  onDiscard: () => void
}) {
  const { yieldG, targetG, doseG, grind, tempC, timeS } = shot
  const ratio = doseG > 0 ? yieldG / doseG : null
  // Discard takes two taps: the first arms it for a few seconds.
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  useEffect(() => {
    if (!confirmDiscard) return
    const id = setTimeout(() => setConfirmDiscard(false), DISCARD_CONFIRM_MS)
    return () => clearTimeout(id)
  }, [confirmDiscard])

  return (
    <Stack gap="md" className="min-h-0 flex-1">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3">
        <div className="flex min-h-0 flex-col gap-3">
          <StopCard cue={verdict(shot)} />
          <Card pad="none" className="shrink-0 divide-y divide-line">
            <div className="grid grid-cols-3 divide-x divide-line">
              <Stat label="Yield" value={yieldG.toFixed(1)} unit="g" note={`Target ${targetG.toFixed(1)} g`} />
              <Stat label="Ratio" value={ratio !== null ? `1:${ratio.toFixed(1)}` : '—'} />
              <Stat label="Time" value={timeS !== undefined ? formatShotClock(Math.round(timeS)) : '—'} note={timeS !== undefined ? undefined : 'Not timed'} />
            </div>
            <div className="grid grid-cols-3 divide-x divide-line">
              <Stat label="Dose" value={doseG.toFixed(1)} unit="g" />
              <Stat label="Grind" value={grind.toFixed(1)} />
              <Stat label="Temp" value={String(tempC)} unit="°C" />
            </div>
          </Card>

          {/* Big, equal touch targets in one row: Save is the way out, the rest are choices. */}
          <div className="grid shrink-0 grid-cols-4 gap-2.5">
            <Button
              size="xl"
              full
              variant={confirmDiscard ? 'danger' : 'quiet'}
              onClick={() => (confirmDiscard ? onDiscard() : setConfirmDiscard(true))}
              disabled={saving}
              className="gap-2 px-3"
            >
              <Trash2 className="h-5 w-5 shrink-0" />
              {confirmDiscard ? 'Sure?' : 'Discard'}
            </Button>
            <Button size="xl" full variant="secondary" onClick={onEdit} disabled={saving} className="gap-2 px-3">
              <Pencil className="h-5 w-5 shrink-0" />
              Edit
            </Button>
            <Button size="xl" full variant="secondary" onClick={onRate} disabled={saving} className="gap-2 px-3">
              <Star className="h-5 w-5 shrink-0" />
              Rate
            </Button>
            <Button size="xl" full variant="primary" onClick={onSave} disabled={saving} className="gap-2 px-3">
              <Check className="h-5 w-5 shrink-0" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {error ? (
            <Text size="sm" className="text-clay">
              {error}
            </Text>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          {/* One tap for how it tasted: the input dial-in suggestions need most, so it is here, not only on Rate. */}
          <Card pad="md" className="flex shrink-0 flex-col gap-2.5">
            <Heading role="label" as="span" tone="faint">
              How did it taste?
            </Heading>
            <div className="grid grid-cols-3 gap-2.5">
              {TASTES.map(({ value, label }) => (
                <Button
                  key={value}
                  size="xl"
                  full
                  variant={shot.result === value ? 'select' : 'quiet'}
                  aria-pressed={shot.result === value}
                  onClick={() => onTaste(value)}
                  disabled={saving}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Card>

          <Card pad="md" className="flex min-h-0 flex-1 flex-col gap-2">
            <Row gap="sm" align="baseline">
              <Heading role="label" as="span" tone="faint">
                Flow
              </Heading>
              <Spacer />
              <Text size="xs" tone="faint">
                {trace ? 'whole shot' : ''}
              </Text>
            </Row>
            <div className="min-h-0 flex-1">
              {trace ? (
                <FlowTrace trace={trace} maxFlow={TRACE_MAX_FLOW} origin={traceOrigin ?? null} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-card border border-dashed border-line px-4 text-center">
                  <Text size="sm" tone="faint">
                    {shot.manual ? 'Entered by hand: no flow to show.' : 'No flow was recorded for this shot.'}
                  </Text>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Stack>
  )
}

/** The headline for how the shot landed, with its numbers in one line. */
function verdict(shot: ShotResult): Cue {
  const { yieldG, targetG, doseG, timeS } = shot
  const parts = [`${yieldG.toFixed(1)} g`, `target ${targetG.toFixed(1)} g`]
  if (doseG > 0) parts.push(`1:${(yieldG / doseG).toFixed(1)}`)
  if (timeS !== undefined) parts.push(formatShotClock(Math.round(timeS)))
  const detail = parts.join(' · ')
  const state = targetState(yieldG, targetG)
  if (state === 'on') return { tone: 'sage', headline: 'On target', detail }
  const grams = Math.abs(yieldG - targetG).toFixed(1)
  return state === 'over'
    ? { tone: 'clay', headline: `${grams} g over`, detail, hint: 'Next time, stop a little sooner.' }
    : { tone: 'ember', headline: `${grams} g short`, detail, hint: 'Next time, stop a little later.' }
}

/** One figure in the stats grid: label, value and unit, tabular so it never jitters. */
function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <Stack gap="xs" className="min-w-0 px-5 py-3.5">
      <Heading role="label" as="span" tone="faint">
        {label}
      </Heading>
      <Row gap="sm" align="baseline">
        <span className="text-[2.25rem] font-semibold leading-none tabular-nums text-ink">{value}</span>
        {unit ? <span className="text-lg text-ink-dim">{unit}</span> : null}
      </Row>
      <Text size="xs" tone="faint" className="min-h-4">
        {note ?? ''}
      </Text>
    </Stack>
  )
}
