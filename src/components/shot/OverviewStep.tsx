import { Activity, Check, History, Pencil, Sparkles, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { FlowTrace, type Trace } from '@/components/shot/FlowTrace'
import { MARK_TONE, type FlowMark } from '@/components/shot/marks'
import { StopCard, type Cue } from '@/components/shot/StopCard'
import { Button, Card, Heading, Row, Spacer, Stack, Text } from '@/components/ui'
import type { ShotResult } from '@/app/router'
import type { AnalysisSnapshot, BrewResult, ShotAnalysisItem } from '@/lib/contracts'
import type { ShotAnalysisHandlers } from '@/lib/data'
import { cn } from '@/lib/cn'
import { CUP_AXES, formatShotClock } from '@/lib/coffee-utils'
import { flowScaleMax, smoothFlow, targetState } from '@/lib/flow'

/** The one-tap taste: the three results the brew log keeps, with short labels for the buttons. */
const TASTES: Array<{ value: BrewResult; label: string }> = [
  { value: 'Sour / Under', label: 'Sour' },
  { value: 'Balanced', label: 'Balanced' },
  { value: 'Bitter / Over', label: 'Bitter' },
]

/** How long Discard waits for its second tap, in milliseconds, before it goes back to asking. */
const DISCARD_CONFIRM_MS = 3000
/** The stretch of the flow each point of the graph is fitted over, in milliseconds (see `smoothFlow`): wide enough to take the 0.1 g steps off, and a parabola still follows a dip of a second. */
const GRAPH_SMOOTH_MS = 900

/**
 * The shot at a glance, always shown after the pull, by scale or by hand: how it landed against the target,
 * its numbers, and the flow over the shot when the scale read it. The actions sit right under the cards:
 * Save (the brew as it is, the main way out), Rate (a second screen, for the cup profile and notes), Edit
 * (the numbers, on the by-hand pull) and Discard (nothing is logged; a first tap turns it into "Sure?", as the
 * shot cannot be pulled again). They are one row of large, equal buttons for the touch screen.
 *
 * The same view shows a logged brew (`takenAt`): then there are no actions, the taste is shown as it was
 * saved, and the verdict goes by the taste, as the stop weight it aimed for is not kept. Either way the
 * Analysis card asks the AI only when "Analyse this shot" is pressed.
 */
export function OverviewStep({
  shot,
  trace,
  traceOrigin,
  takenAt,
  saving = false,
  error = null,
  onEdit,
  onRate,
  onTaste,
  onSave,
  onDiscard,
  analyse,
  initialAnalysis,
  onAnalysis,
  taste,
}: {
  shot: ShotResult
  /** The flow over the whole shot, when the scale read it. */
  trace?: Trace | null
  /** When the shot timer started, on the trace's clock, for its time marks. */
  traceOrigin?: number | null
  /** When a logged brew was made: the view is of the past, read only. */
  takenAt?: string
  saving?: boolean
  error?: string | null
  /** The actions of a shot just pulled; without them (a logged brew) there is no action row. */
  onEdit?: () => void
  onRate?: () => void
  /** Pick how the shot tasted (the same again clears it); it is saved as the brew's result. Without it the taste is shown, not picked. */
  onTaste?: (taste: BrewResult) => void
  onSave?: () => void
  /** Leave without logging the shot. */
  onDiscard?: () => void
  /** How the cup was described (a logged brew): its 1-5 positions, notes and the change it noted. Shown in the verdict. */
  taste?: TasteNotes
  /** A reading already made, shown as the analysis to begin with (a saved one, or one kept while the shot was rated). */
  initialAnalysis?: AnalysisSnapshot
  /**
   * Told the finished reading each time it changes, or null while there is none or it is out of date (the taste
   * changed since): a new shot keeps it to send with the brew when it is logged.
   */
  onAnalysis?: (analysis: AnalysisSnapshot | null) => void
  /** Ask the AI to read this shot (its curve, taste, the bean and its last shots). About 10 s; the items arrive as it writes them. */
  analyse: (handlers: ShotAnalysisHandlers) => Promise<void>
}) {
  const { yieldG, targetG, doseG, grind, tempC, timeS } = shot
  const ratio = doseG > 0 ? yieldG / doseG : null
  // The right-hand card shows the flow or the AI's reading of it. The analysis runs when "Analyse this shot"
  // is pressed; a taste changed after it ran makes it stale, and "Re-analyse" asks again.
  // The finding the person tapped, on the graph or in the list: both show it.
  const [activeFinding, setActiveFinding] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisState>(() =>
    initialAnalysis
      ? { status: 'done', items: initialAnalysis.items, taste: initialAnalysis.taste, thoughtS: initialAnalysis.thoughtS ?? null }
      : { status: 'idle' },
  )
  // The graph shows the flow smoothed; the AI reads it as the scale gave it.
  const smoothed = useMemo(() => (trace ? { ...trace, points: smoothFlow(trace.points, GRAPH_SMOOTH_MS) } : null), [trace])
  // Each run has a number; a run that is no longer the latest (the person asked again) is ignored.
  const run = useRef(0)
  // A shot entered by hand has no flow to show and nothing for the AI to read: its flow and analysis are left out.
  const byHand = shot.manual === true
  // The right-hand column holds the taste buttons (a new shot) and the analysis: by hand and logged, it has nothing.
  const showReading = !byHand || Boolean(onTaste)
  // A shot the scale did not record has no curve: the analysis stays, but is off, with the reason.
  const noFlow = trace ? undefined : 'The scale did not record the flow of this shot, so the AI has no curve to read.'
  const runAnalysis = () => {
    if (noFlow) return
    const taste = shot.result
    const mine = ++run.current
    const current = () => run.current === mine
    setActiveFinding(null)
    setAnalysis({ status: 'running', items: [], thought: '', startedAt: Date.now(), thoughtS: null })
    analyse({
      // The thinking ends when the first item arrives: later thoughts are not shown.
      onThinking: (text) =>
        current() &&
        setAnalysis((state) =>
          state.status === 'running' && state.thoughtS === null ? { ...state, thought: (state.thought + text).slice(-2000) } : state,
        ),
      onItem: (item) =>
        current() &&
        setAnalysis((state) =>
          state.status === 'running' ? { ...state, items: [...state.items, item], thoughtS: state.thoughtS ?? secondsSince(state.startedAt) } : state,
        ),
    })
      .then(
        () =>
          current() &&
          setAnalysis((state) =>
            state.status === 'running'
              ? { status: 'done', items: state.items, taste, thoughtS: state.thoughtS ?? secondsSince(state.startedAt) }
              : state,
          ),
      )
      .catch(
        (err: unknown) =>
          current() &&
          setAnalysis((state) => ({
            status: 'error',
            items: state.status === 'running' ? state.items : [],
            thoughtS: state.status === 'running' ? state.thoughtS : null,
            message: err instanceof Error ? err.message : 'The analysis failed.',
          })),
      )
  }
  // A finding at a moment (or over a stretch) of the shot gets a number: it is marked on the graph and listed
  // under the same number. The findings about the whole shot or the previous shot have no place on it, so no number.
  const marks: FlowMark[] = (analysis.status === 'idle' ? [] : momentsOf(analysis.items)).map((finding, index) => ({
    id: index + 1,
    atS: finding.atS,
    untilS: finding.untilS,
    label: finding.label,
    tone: finding.severity,
  }))
  const pickFinding = (id: number) => {
    setActiveFinding((current) => (current === id ? null : id))
    document.getElementById(`finding-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  const stale = analysis.status === 'done' && analysis.taste !== shot.result
  useEffect(() => {
    onAnalysis?.(
      analysis.status === 'done' && !stale ? { items: analysis.items, taste: analysis.taste, thoughtS: analysis.thoughtS ?? undefined } : null,
    )
  }, [analysis, stale, onAnalysis])

  // Discard takes two taps: the first arms it for a few seconds.
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  useEffect(() => {
    if (!confirmDiscard) return
    const id = setTimeout(() => setConfirmDiscard(false), DISCARD_CONFIRM_MS)
    return () => clearTimeout(id)
  }, [confirmDiscard])

  return (
    <Stack gap="md" className="min-h-0 flex-1">
      <div className={cn('grid min-h-0 flex-1 gap-3', showReading ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]' : 'grid-cols-1')}>
        {/* The data: how the shot landed, its numbers and its flow. The graph takes the room that is left. */}
        <div className="flex min-h-0 flex-col gap-3">
          <StopCard cue={takenAt ? pastVerdict(shot) : verdict(shot)}>
            {taste ? <TasteProfile taste={taste} /> : null}
          </StopCard>
          <Card pad="none" className="shrink-0 divide-y divide-line">
            <div className="grid grid-cols-3 divide-x divide-line">
              <Stat label="Yield" value={yieldG.toFixed(1)} unit="g" note={takenAt ? undefined : `Target ${targetG.toFixed(1)} g`} />
              <Stat label="Ratio" value={ratio !== null ? `1:${ratio.toFixed(1)}` : '—'} />
              <Stat label="Time" value={timeS !== undefined ? formatShotClock(Math.round(timeS)) : '—'} note={timeS !== undefined ? undefined : 'Not timed'} />
            </div>
            <div className="grid grid-cols-3 divide-x divide-line">
              <Stat label="Dose" value={doseG.toFixed(1)} unit="g" />
              <Stat label="Grind" value={grind.toFixed(1)} />
              <Stat label="Temp" value={String(tempC)} unit="°C" />
            </div>
          </Card>

          {/* The graph sits with the numbers, not under the reading: its marks are the findings, so both are in view. */}
          {!byHand ? (
            <Card pad="md" className="flex min-h-[11rem] flex-1 flex-col gap-2">
              <Row gap="sm" align="baseline">
                <Heading role="label" as="span" tone="faint">
                  Flow
                </Heading>
                <Text size="xs" tone="faint">
                  {trace ? 'whole shot' : ''}
                </Text>
              </Row>
              <div className="min-h-0 flex-1">
                {trace ? (
                  <FlowTrace trace={smoothed} curved maxFlow={flowScaleMax(smoothed?.points ?? [])} origin={traceOrigin ?? null} marks={marks} activeMark={activeFinding} onMark={pickFinding} />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-card border border-dashed border-line px-4 text-center">
                    <Text size="sm" tone="faint">
                      No flow was recorded for this shot.
                    </Text>
                  </div>
                )}
              </div>
            </Card>
          ) : null}

          {/* Big, equal touch targets in one row: Save is the way out, the rest are choices. */}
          {onSave && onRate && onEdit && onDiscard ? (
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
          ) : null}
          {error ? (
            <Text size="sm" className="text-clay">
              {error}
            </Text>
          ) : null}
        </div>

        {/* The reading: the taste (picked here on a new shot; a logged one shows it in the verdict) and the AI's analysis. */}
        {showReading ? (
          <div className="flex min-h-0 flex-col gap-3">
            {/* One tap for how it tasted: the input dial-in suggestions need most, so it is here, not only on Rate. */}
            {onTaste ? (
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
            ) : null}

            {!byHand ? (
              <Card pad="md" className="flex min-h-0 flex-1 flex-col gap-3">
                <Row gap="sm" align="center" className="min-h-9">
                  <Sparkles className={cn('h-4 w-4', analysis.status === 'running' && analysis.thoughtS === null ? 'animate-pulse text-ember' : 'text-ink-faint')} />
                  <Heading role="label" as="span" tone="faint">
                    Analysis
                  </Heading>
                  <Spacer />
                  {analysis.status === 'done' ? (
                    <Button size="sm" variant="quiet" onClick={runAnalysis}>
                      {stale ? 'Taste changed · Re-analyse' : 'Re-analyse'}
                    </Button>
                  ) : null}
                </Row>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <AnalysisView state={analysis} onRetry={runAnalysis} unavailable={noFlow} activeFinding={activeFinding} onFinding={pickFinding} />
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </Stack>
  )
}

/**
 * Where the AI's reading of the shot stands. `items` are what it has written so far; `thought` is what it
 * has been working out, until its first item (`thoughtS` is how many seconds that took, null while it thinks).
 * `taste` is the taste it was asked with, to tell when it is stale.
 */
type AnalysisState =
  | { status: 'idle' }
  | { status: 'running'; items: ShotAnalysisItem[]; thought: string; startedAt: number; thoughtS: number | null }
  | { status: 'done'; items: ShotAnalysisItem[]; taste: BrewResult | undefined; thoughtS: number | null }
  | { status: 'error'; items: ShotAnalysisItem[]; message: string; thoughtS: number | null }

type Observation = Extract<ShotAnalysisItem, { kind: 'observation' }>

/** The findings that sit on the graph, in the order they were written: each has a time, which is what its number marks. */
function momentsOf(items: ShotAnalysisItem[]): Array<Observation & { atS: number }> {
  return items.filter((item): item is Observation & { atS: number } => item.kind === 'observation' && item.scope === 'moment' && item.atS !== null)
}

/** A time or a stretch in seconds, to a tenth: "6.0 s", "13.6–14.7 s". */
function whenLabel({ atS, untilS }: { atS: number; untilS?: number | null }): string {
  return untilS ? `${atS.toFixed(1)}–${untilS.toFixed(1)} s` : `${atS.toFixed(1)} s`
}

/**
 * The AI's reading of the shot, shown as it is written: the summary, what to change on the next shot (big,
 * numbered, the first one to make), what the curve shows, then how sure it is and what it lacked. The
 * findings are in three groups: the numbered ones sit on the graph above under the same number (a stretch is
 * shaded), then the ones about the whole shot and about the previous shot, which have no place on the graph
 * and no number. The items arrive in that order, so each part is added below the last and nothing moves.
 */
function AnalysisView({
  state,
  onRetry,
  unavailable,
  activeFinding,
  onFinding,
}: {
  state: AnalysisState
  onRetry: () => void
  /** Why the AI cannot read this shot (no flow curve); the button is off and this is said in its place. */
  unavailable?: string
  activeFinding: number | null
  onFinding: (id: number) => void
}) {
  if (state.status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Text tone="dim">{unavailable ?? 'The AI reads the flow curve with the taste, the bean and its last shots, and says what to change next.'}</Text>
        <Button size="xl" variant="primary" onClick={onRetry} disabled={Boolean(unavailable)} className="gap-2">
          <Sparkles className="h-5 w-5" />
          Analyse this shot
        </Button>
      </div>
    )
  }
  if (state.status === 'error' && state.items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Text tone="dim">{state.message}</Text>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }
  const { items } = state
  const summary = items.find((item) => item.kind === 'summary')
  const suggestions = items.filter((item) => item.kind === 'suggestion')
  const moments = momentsOf(items)
  const wholeShot = items.filter((item): item is Observation => item.kind === 'observation' && item.scope === 'shot')
  const previous = items.filter((item): item is Observation => item.kind === 'observation' && item.scope === 'previous')
  const verdict = items.find((item) => item.kind === 'verdict')
  return (
    <Stack gap="md" className="pb-1">
      <ThinkingLine thought={state.status === 'running' ? state.thought : ''} seconds={state.thoughtS} />

      {summary ? <Text className="arrive text-[1.1875rem] font-medium leading-snug text-ink">{summary.text}</Text> : null}

      {suggestions.length === 0 && state.status === 'done' ? (
        <Row gap="sm" align="center" className="arrive rounded-card border border-sage/45 bg-sage/12 px-3 py-2.5">
          <Check className="h-4 w-4 shrink-0 text-sage" />
          <Text size="sm" className="text-ink">
            No change needed for the next shot.
          </Text>
        </Row>
      ) : null}

      {suggestions.length ? (
        <Stack gap="sm" className="border-t border-line pt-3">
          <Heading role="label" as="span" tone="faint">
            Next shot
          </Heading>
          {suggestions.map((suggestion, index) => (
            <div key={index} className={cn('arrive flex gap-3 rounded-card border p-3', index === 0 ? 'border-ember/45 bg-ember/12' : 'border-line')}>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  index === 0 ? 'bg-ember text-ember-text' : 'bg-raised text-ink-dim',
                )}
              >
                {index + 1}
              </span>
              <Stack gap="xs" className="min-w-0">
                <span className="text-[1.125rem] font-semibold leading-snug text-ink">{suggestion.change}</span>
                <Text size="sm" tone="dim">
                  {suggestion.why}
                </Text>
                <Text size="xs" tone="faint">
                  Expect: {suggestion.expect}
                </Text>
              </Stack>
            </div>
          ))}
        </Stack>
      ) : null}

      {moments.length ? (
        <Stack gap="sm" className="border-t border-line pt-3">
          <Heading role="label" as="span" tone="faint">
            What the curve shows
          </Heading>
          {moments.map((observation, index) => {
            const id = index + 1
            return (
              <button
                key={id}
                id={`finding-${id}`}
                type="button"
                onClick={() => onFinding(id)}
                aria-pressed={id === activeFinding}
                className={cn(
                  'arrive -mx-2.5 flex w-[calc(100%+1.25rem)] items-baseline gap-2.5 rounded-card px-2.5 py-2 text-left transition-colors active:bg-raised',
                  id === activeFinding ? 'bg-raised' : 'bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 translate-y-0.5 items-center justify-center self-start rounded-full text-[0.6875rem] font-semibold tabular-nums text-ember-text',
                    MARK_TONE[observation.severity],
                  )}
                >
                  {id}
                </span>
                <span className="min-w-[5.75rem] shrink-0 whitespace-nowrap text-sm tabular-nums text-ink-faint">{whenLabel(observation)}</span>
                <Stack gap="xs" className="min-w-0">
                  <Text size="sm" className="text-ink">
                    {observation.finding}
                  </Text>
                  {observation.why ? (
                    <Text size="sm" tone="dim">
                      {observation.why}
                    </Text>
                  ) : null}
                </Stack>
              </button>
            )
          })}
        </Stack>
      ) : null}

      <Notes title="Across the shot" icon={Activity} notes={wholeShot} />
      <Notes title="Against the last shot" icon={History} notes={previous} />

      {verdict ? (
        <div className="arrive flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-dim">Confidence · {verdict.confidence}</span>
          {verdict.missing.length ? (
            <Text size="xs" tone="faint">
              Missing: {verdict.missing.join('; ')}
            </Text>
          ) : null}
        </div>
      ) : null}

      {state.status === 'error' ? (
        <Row gap="sm" align="center">
          <Text size="sm" tone="dim">
            {state.message}
          </Text>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </Row>
      ) : null}
    </Stack>
  )
}

/** Findings that are not at a moment of the curve: a coloured icon beside each, in place of a number, and nothing to tap. */
function Notes({ title, icon: Icon, notes }: { title: string; icon: typeof Activity; notes: Observation[] }) {
  if (notes.length === 0) return null
  return (
    <Stack gap="sm" className="border-t border-line pt-3">
      <Heading role="label" as="span" tone="faint">
        {title}
      </Heading>
      {notes.map((note, index) => (
        <Row key={index} gap="sm" align="baseline" className="arrive">
          <span className={cn('flex h-5 w-5 shrink-0 translate-y-0.5 items-center justify-center self-start rounded-full text-ember-text', MARK_TONE[note.severity])}>
            <Icon className="h-3 w-3" aria-hidden />
          </span>
          <Stack gap="xs" className="min-w-0">
            <Text size="sm" className="text-ink">
              {note.finding}
            </Text>
            {note.why ? (
              <Text size="sm" tone="dim">
                {note.why}
              </Text>
            ) : null}
          </Stack>
        </Row>
      ))}
    </Stack>
  )
}

/** What was recorded about the cup: positions on the profile axes (1 to 5), free notes, and the change noted for next time. */
export type TasteNotes = {
  cup: Partial<Record<(typeof CUP_AXES)[number]['key'], number | undefined>>
  notes?: string
  adjustment?: string
}

/**
 * The cup, in the verdict card: the profile axes as dots (a position on a named continuum, not a score, so
 * no bar and no number), then the notes and the change noted. Axes and texts that were not recorded are left
 * out, and with nothing recorded there is nothing here.
 */
function TasteProfile({ taste }: { taste: TasteNotes }) {
  const axes = CUP_AXES.filter((axis) => taste.cup[axis.key] != null)
  if (axes.length === 0 && !taste.notes && !taste.adjustment) return null
  return (
    <Stack gap="sm">
      {axes.length ? (
        <div className="grid grid-cols-4 gap-4">
          {axes.map((axis) => {
            const value = taste.cup[axis.key] ?? 0
            return (
              <Stack key={axis.key} gap="xs" className="min-w-0" title={`${axis.low} – ${axis.high}`}>
                <Text size="xs" tone="faint" className="truncate">
                  {axis.label}
                </Text>
                <Row gap="xs" align="center" aria-label={`${axis.label} ${value} of 5, from ${axis.low} to ${axis.high}`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={cn('h-2 w-2 rounded-full', i < value ? 'bg-ink' : 'bg-line')} />
                  ))}
                </Row>
              </Stack>
            )
          })}
        </div>
      ) : null}
      {taste.notes ? (
        <Text size="sm" className="text-ink">
          <span className="text-ink-faint">Notes · </span>
          {taste.notes}
        </Text>
      ) : null}
      {taste.adjustment ? (
        <Text size="sm" className="text-ink">
          <span className="text-ink-faint">Next time · </span>
          {taste.adjustment}
        </Text>
      ) : null}
    </Stack>
  )
}

/** Whole seconds since `startedAt` (a `Date.now()`), at least 1. */
function secondsSince(startedAt: number): number {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000))
}

/**
 * One line for the AI's thinking. While it thinks: the latest bold heading of its thoughts (Gemini writes
 * them as `**Heading** text`), which changes as the thinking moves on. Once the first item is in: how long it took.
 * The card's own sparkle, in its header, pulses meanwhile: this line has no icon of its own.
 */
function ThinkingLine({ thought, seconds }: { thought: string; seconds: number | null }) {
  if (seconds !== null) {
    return (
      <Text size="xs" tone="faint">
        Thought for {seconds} {seconds === 1 ? 'second' : 'seconds'}
      </Text>
    )
  }
  const heading = [...thought.matchAll(/\*\*(.+?)\*\*/g)].at(-1)?.[1]
  return (
    <Text key={heading} size="xs" tone="dim" className="arrive truncate">
      {heading ?? 'Thinking…'}
    </Text>
  )
}

/** The headline for a logged brew: its taste (the stop weight it aimed for is not kept). The numbers are in the cards below, the date in the page header. */
function pastVerdict(shot: ShotResult): Cue {
  const detail = ''
  switch (shot.result) {
    case 'Balanced':
      return { tone: 'sage', headline: 'Balanced', detail }
    case 'Sour / Under':
      return { tone: 'ember', headline: 'Sour', detail, hint: 'Under-extracted: grind finer or run longer.' }
    case 'Bitter / Over':
      return { tone: 'clay', headline: 'Bitter', detail, hint: 'Over-extracted: grind coarser or stop sooner.' }
    default:
      return { tone: 'ink', headline: 'Not rated', detail }
  }
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
