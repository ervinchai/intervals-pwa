import { FlowTrace, type Trace } from '@/components/shot/FlowTrace'
import { StopCard, type Cue } from '@/components/shot/StopCard'
import { Button, Card, Heading, Row, Spacer, Stack, Text } from '@/components/ui'
import type { ShotResult } from '@/app/router'
import { formatShotClock } from '@/lib/coffee-utils'
import { targetState } from '@/lib/flow'

/** The top of the flow graph, in g/s: the same scale as on the pull. */
const TRACE_MAX_FLOW = 3

/**
 * The shot at a glance, always shown after the pull, by scale or by hand: how it landed against the target,
 * its numbers, and the flow over the shot when the scale read it. From here the brew is saved as it is
 * ("Save & close", the main way out), or rated first (a second screen, for the cup profile and notes), or
 * its numbers edited on the by-hand pull.
 */
export function OverviewStep({
  shot,
  trace,
  traceOrigin,
  saving,
  error,
  onEdit,
  onRate,
  onSave,
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
  onSave: () => void
}) {
  const { yieldG, targetG, doseG, grind, tempC, timeS } = shot
  const ratio = doseG > 0 ? yieldG / doseG : null

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
        </div>

        <Card pad="md" className="flex min-h-0 flex-col gap-2">
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

      <Row gap="md" align="center" className="shrink-0">
        <Button variant="ghost" onClick={onEdit} disabled={saving}>
          Edit numbers
        </Button>
        <Spacer />
        {error ? (
          <Text size="sm" className="text-clay">
            {error}
          </Text>
        ) : null}
        <Button variant="secondary" onClick={onRate} disabled={saving}>
          Rate
        </Button>
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save & close'}
        </Button>
      </Row>
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
