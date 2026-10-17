import { useEffect, useMemo, useRef, useState } from 'react'

import { CupGauge, type GaugeTone } from '@/components/shot/CupGauge'
import { FlowTrace, type Trace } from '@/components/shot/FlowTrace'
import { StopCard, type Cue } from '@/components/shot/StopCard'
import { Button, Card, Heading, Row, Scrubber, Spacer, Stack, Text } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  FLOW_ENTER,
  NOT_FINISHED,
  NO_LATCH,
  flowRate,
  flowScaleMax,
  guideStop,
  latchCue,
  readShot,
  targetState,
  trackFinish,
  recordShot,
  type Sample,
  type ShotRecord,
  type ShotReadout,
  type StopCue,
  type StopGuide,
} from '@/lib/flow'
import type { PumpSignal } from '@/lib/contracts'
import { useScale, type Scale, type ScaleConnection } from '@/lib/scale'

/**
 * How long, in seconds, the flow takes to die away once the pump stops: the "run-on". It is the
 * one number the predicted finish and the stop point depend on, and it belongs to the machine, the
 * basket and the puck, so it is a setting. It is kept on this device.
 *
 * The default is an estimate, not a measurement. Advice for stopping early runs from about 0.5 g to
 * about 3 g (more, up to 6 g, when padded for spouts and scale lag), and a shot ends at about 1.5 to
 * 2 g/s, so the grams still to come divided by that flow is roughly 0.3 to 2 s. 1.2 s sits in the
 * middle of the common reports of 1.5 to 3 g. Calibrate it on the real machine.
 */
const RUN_ON_KEY = 'intervals.runOnSeconds'
const DEFAULT_RUN_ON_S = 1.2
const MIN_RUN_ON_S = 0.1
const MAX_RUN_ON_S = 3

function loadRunOn(): number {
  try {
    const stored = Number(localStorage.getItem(RUN_ON_KEY))
    return Number.isFinite(stored) && stored >= MIN_RUN_ON_S && stored <= MAX_RUN_ON_S ? stored : DEFAULT_RUN_ON_S
  } catch {
    return DEFAULT_RUN_ON_S
  }
}

function saveRunOn(seconds: number) {
  try {
    localStorage.setItem(RUN_ON_KEY, String(seconds))
  } catch {
    // Private mode or blocked storage: the setting just lasts until the screen closes.
  }
}

const MIN_TARGET_G = 10
const MAX_TARGET_G = 80

/** How far back the flow trace draws, in milliseconds. */
const TRACE_MS = 15_000

/**
 * The pull: the shot read from the scale under the cup. It is a glance-and-act step, so it is built in
 * three tiers: the card on top says what to do (keep going, get ready, stop now, too late), driven by
 * the stop point, the weight at which switching the pump off lets the drip land on the target. Beside it
 * the cup gauge shows the level against that mark. Under it are the weight and the predicted finish, then the
 * shot card: the timer and the flow over the flow graph, one unit on one time axis. The settings the
 * estimate depends on sit under the cup; the row at the foot holds only actions, with Tare & start on the right. The flow shows only after a tare from this screen: before it the cup is
 * not zeroed, so nothing the scale says is a shot yet.
 *
 * The shot time runs from the pump going on to going off: the demo's buttons, or a pump sensor on the real
 * machine. Without one (`pump` is `none`, the real scale today) the shot is read from the flow, so the cues
 * work as before, and the timer is started by tapping the flow graph; it stops at a second tap, or when the
 * flow dies away. The graph only moves while coffee flows, so it holds the shot's shape once it is over.
 * Reset starts the shot over on screen without taring. "Tare & start" tares and starts the timer in one tap,
 * at the first reading after the tare. The cup gauge stays empty until the screen is tared and the timer runs.
 *
 * When the flow has been at nothing for about six seconds the shot is over and `onFinished` is called with
 * the weight. The target comes from the recipe and stays fixed (it can be changed here, for this shot).
 *
 * The readings come from Rails (see `useScale`): the simulated machine, whose Start and Stop buttons are
 * shown only then, or the real scale through Home Assistant. While the stream from Rails is not open the
 * card says so, whatever the numbers last were.
 */
export function PullStep({
  targetG,
  doseG,
  tempC,
  onTemp,
  onBack,
  onFinished,
  onRunningChange,
  onManual,
}: {
  /** The yield to aim for, in grams: the recipe's. */
  targetG: number
  /** The dose that went in, for the ratio. */
  doseG: number
  onBack: () => void
  /** The water temperature in °C: not read by the scale, so it is set here, as on the by-hand screen. */
  tempC: number
  onTemp: (celsius: number) => void
  /** The shot is over: its numbers, and the flow over the whole shot for the overview (`traceOrigin`: the timer's start). */
  onFinished: (result: {
    yieldG: number
    targetG: number
    timeS?: number
    trace: Trace | null
    traceOrigin: number | null
    /** The shot's readings and figures, for the brew log; null when no flow was seen. */
    record: ShotRecord | null
  }) => void
  /** Told when the pump goes on or off, so the screen around can hold back its own ways out mid-shot. */
  onRunningChange: (running: boolean) => void
  /** Switch to typing the shot in by hand: offered while the scale is not there. */
  onManual: () => void
}) {
  const scale = useScale()
  const [runOn, setRunOnState] = useState(loadRunOn)
  // A target set here wins over the recipe's, for this shot.
  const [targetOverride, setTargetOverride] = useState<number | null>(null)

  function setRunOn(seconds: number) {
    setRunOnState(seconds)
    saveRunOn(seconds)
  }

  const { samples, weight, shown, flow, flowing, stable } = scale
  // Until the first tare from this screen nothing on the scale is a shot: a finger, a cup being set down. With
  // no pump sensor the phase comes from the flow, so it is held at idle until then; the readouts wait too.
  const phase = scale.pump === 'none' && !scale.tared ? 'idle' : scale.phase
  const target = targetOverride ?? targetG
  const running = phase === 'running'
  useEffect(() => {
    onRunningChange(running)
    return () => onRunningChange(false)
  }, [running, onRunningChange])

  const guide = guideStop({ phase, weight, flow, flowing, stable, runOn, target })

  // The cue only moves forward through a shot, and the result is frozen once the drip is over, so
  // a wobble in the numbers cannot take back "stop now" in the half second you have to act on it.
  // (Stored while rendering, not in an effect, so there is no frame with the old cue.)
  const [latch, setLatch] = useState(NO_LATCH)
  const latched = latchCue(latch, phase, guide, weight)
  if (latched.latch !== latch) setLatch(latched.latch)
  const cue = latched.cue
  const frozen = cue === 'settled'
  const shot = readShot({
    phase,
    weight: frozen ? latched.finalWeight : weight,
    flow,
    flowing,
    stable: stable || frozen,
    runOn,
    target,
  })
  const message = cueFor(cue, guide, shot, latched.finalWeight, target, scale.shotSeconds, scale.pump)
  // Until the readings are coming an overlay covers the pull: "Waiting for scale…" from the first moment (it is
  // the screen's starting state), and an error with a retry when the connection fails.
  const overlay = linkOverlay(scale.connection)
  // Nothing flows before a shot, whatever a rough scale's noise says, nor before the cup was tared.
  const flowShown = scale.tared && phase !== 'idle' && shot.flowing

  // When the flow has been at nothing for about six seconds, the shot is over: hand the weight on. (Stored
  // while rendering, like the latch; handing it on is an effect.)
  const [finish, setFinish] = useState(NOT_FINISHED)
  const nextFinish = trackFinish(finish, { phase, flowing, flow, weight, now: samples.at(-1)?.t ?? null })
  if (nextFinish !== finish) setFinish(nextFinish)
  const { finished, finishedWeight } = nextFinish
  // The shot time, to the second: how long the pump ran, or the time taken by hand; else none.
  const timeS = scale.shotSeconds === null ? undefined : Math.round(scale.shotSeconds)
  // The flow over the whole shot, for the overview: from the timer's start (or 2 s before the first flow) to
  // the end of the flow. Kept in a ref, refreshed after every render, so handing the shot on reads it
  // without re-running each time a reading arrives.
  const shotTrace = useRef<WholeShot>(NO_SHOT)
  const traceOrigin = scale.timer.start
  const timedBy = scale.timer.by
  // Declared before the effect below, so after each render it runs first and that one reads it fresh.
  useEffect(() => {
    shotTrace.current = wholeShot(samples, traceOrigin, scale.flowEnd, timedBy)
  })
  useEffect(() => {
    if (!finished || finishedWeight === null) return
    const { trace, record } = shotTrace.current
    onFinished({ yieldG: Math.round(finishedWeight * 10) / 10, targetG: target, timeS, trace, traceOrigin, record })
  }, [finished, finishedWeight, onFinished, target, timeS, traceOrigin])

  // Tapping the weight tares. Not while the pump runs: a stray tap must not wipe a shot.
  const canTare = phase !== 'running'

  // The flow for the trace: the same flow as the readout, at every reading (the scale's own when it sends one,
  // else the estimate). While the timer runs it shows the whole shot so far, from the timer's start to now
  // (at least TRACE_MS wide, so the first seconds are not stretched), and never stands still. Otherwise it
  // shows the last TRACE_MS up to the last moment coffee flowed: it stops with the flow, and is empty
  // before the first drops.
  const { flowEnd } = scale
  const timing = scale.timer.start !== null && scale.timer.stop === null ? scale.timer.start : null
  const { tared } = scale
  const trace = useMemo((): Trace | null => {
    if (!tared) return null
    const last = samples.at(-1)
    let start: number
    let end: number
    if (timing !== null && last) {
      end = last.t
      start = timing
    } else if (flowEnd !== null) {
      end = flowEnd
      start = flowEnd - TRACE_MS
    } else {
      return null
    }
    const windowMs = Math.max(end - start, TRACE_MS)
    const points = samples
      .filter((sample) => sample.t >= start && sample.t <= end)
      .map((sample) => ({ t: sample.t, f: sample.f ?? flowRate(samples, sample.t) }))
      .filter((point): point is { t: number; f: number } => point.f !== null)
    return { start, windowMs, points }
  }, [samples, flowEnd, timing, tared])

  // A running timer ticks on this device's clock, ten times a second, not with each reading's arrival.
  const timerRunning = scale.timer.start !== null && scale.timer.stop === null
  const localNow = useLocalNow(timerRunning)
  const time = shotTime(scale, localNow)
  // With no pump signal the graph starts and stops the timer, until it has stopped once (Reset clears it).
  const canTapTimer = scale.tared && scale.handTimer && scale.timer.stop === null && scale.connection === 'live'
  const gaugeTone: GaugeTone = message.tone === 'sage' ? 'sage' : message.tone === 'clay' ? 'clay' : 'ember'
  const showStopPoint = running && shot.flowing
  // The cup stays empty until the shot has begun: tared from this screen, and the timer started.
  const cupLive = scale.tared && scale.timer.start !== null
  // Tare & start is for a shot not begun yet. With a pump sensor the timer starts with the pump, so a plain
  // tare (tap the weight) is all there is.
  const canTareAndStart =
    scale.pump !== 'sensor' && scale.connection === 'live' && phase === 'idle' && (scale.timer.start === null || scale.timer.stop !== null)

  return (
    <Stack gap="md" className="min-h-0 flex-1">
      <div className="relative grid min-h-0 flex-1 grid-cols-[17rem_minmax(0,1fr)] gap-3">
        {overlay ? <ScaleOverlay overlay={overlay} onRetry={scale.retry} onManual={onManual} /> : null}
        <div className="flex min-h-0 flex-col gap-3">
          <Card pad="md" className="flex min-h-0 flex-1 flex-col gap-3">
            <Heading role="label" as="span" tone="faint">
              Cup
            </Heading>
            <div className="min-h-0 flex-1">
              <CupGauge
                weight={cupLive ? weight : 0}
                projected={cupLive && shot.showEstimate ? shot.projected : null}
                target={target}
                stopAt={cupLive && showStopPoint ? guide.stopAt : null}
                tone={gaugeTone}
              />
            </div>
          </Card>
          {/* The three settings the shot depends on, out of the way of the actions. */}
          <Card pad="sm" className="flex shrink-0 flex-col gap-1">
            <Scrubber
              className="w-full"
              label="Target"
              value={target}
              onChange={setTargetOverride}
              step={0.5}
              min={MIN_TARGET_G}
              max={MAX_TARGET_G}
              format={(value) => value.toFixed(1)}
              unit="g"
            />
            <Scrubber className="w-full" label="Temp" value={tempC} onChange={onTemp} step={1} min={70} max={100} unit="°C" />
            <Scrubber
              className="w-full"
              label="Run-on"
              value={runOn}
              onChange={setRunOn}
              step={0.1}
              min={MIN_RUN_ON_S}
              max={MAX_RUN_ON_S}
              format={(value) => value.toFixed(1)}
              unit="s"
            />
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <StopCard cue={message} />

          <Card pad="none" className="grid shrink-0 grid-cols-[1fr_1fr] divide-x divide-line">
            <Readout
              label="Weight"
              value={scale.tared ? shown.toFixed(1) : '—'}
              unit={scale.tared ? 'g' : ''}
              large
              note={canTare ? 'Tap to tare' : undefined}
              onTap={canTare ? scale.tare : undefined}
            />
            <Readout
              label={shot.estimateLabel}
              value={shot.showEstimate ? shot.projected.toFixed(1) : '—'}
              unit={shot.showEstimate ? 'g' : ''}
              valueClass={shot.showEstimate ? ESTIMATE_COLOR[shot.state ?? 'none'] : undefined}
              note={shot.showEstimate ? estimateNote(shot, target, doseG) : undefined}
            />
          </Card>

          <ShotCard
            trace={trace}
            origin={scale.timer.start}
            time={time}
            flow={flowShown && flow !== null ? flow.toFixed(1) : null}
            hint={tared ? timerHint(scale) : 'Tare to start'}
            tared={tared}
            onTap={canTapTimer ? scale.tapTimer : undefined}
          />
        </div>
      </div>

      <Row gap="md" align="center" className="shrink-0">
        <Button variant="ghost" onClick={onBack} disabled={running}>
          Back
        </Button>
        {/* Nothing to reset, and no pump to simulate, until the readings are coming: before that the pump signal
            is only the default ("demo"), not what the machine really has. */}
        {scale.connection === 'live' ? (
          <Button variant="secondary" onClick={scale.reset}>
            Reset
          </Button>
        ) : null}
        {/* Demo only: these stand in for the machine's pump, and the toggle makes the scale behave like a rough real one. */}
        {scale.connection === 'live' && scale.pump === 'demo' ? (
          <>
            <Button variant="quiet" onClick={scale.start} disabled={phase !== 'idle' || scale.connection !== 'live'}>
              Start pump
            </Button>
            <Button variant="quiet" onClick={scale.stopPump} disabled={!running}>
              Stop pump
            </Button>
            <Button size="sm" variant={scale.rough ? 'select' : 'quiet'} onClick={() => scale.setRough(!scale.rough)}>
              Noisy scale
            </Button>
          </>
        ) : null}
        <Spacer />
        {scale.pump !== 'sensor' ? (
          <Button variant="primary" onClick={scale.tareAndStart} disabled={!canTareAndStart}>
            Tare &amp; start
          </Button>
        ) : null}
      </Row>
    </Stack>
  )
}

/** A whole shot: its flow for the overview's graph, and its record for the brew log. */
type WholeShot = { trace: Trace | null; record: ShotRecord | null }
const NO_SHOT: WholeShot = { trace: null, record: null }

/**
 * The whole shot, from the timer's start (else 2 s before the first flow) to the last flow: the flow for the
 * graph, and the readings with their figures for the brew log.
 */
function wholeShot(samples: readonly Sample[], timerStart: number | null, flowEnd: number | null, timedBy: 'pump' | 'hand' | null): WholeShot {
  if (flowEnd === null) return NO_SHOT
  const withFlow = samples
    .map((sample) => ({ t: sample.t, g: sample.g, f: sample.f ?? flowRate(samples, sample.t) }))
    .filter((point): point is { t: number; g: number; f: number } => point.f !== null)
  const firstFlow = withFlow.find((point) => point.f >= FLOW_ENTER)?.t
  const start = timerStart ?? (firstFlow === undefined ? null : firstFlow - 2000)
  if (start === null || flowEnd <= start) return NO_SHOT
  const points = withFlow.filter((point) => point.t >= start && point.t <= flowEnd).map(({ t, f }) => ({ t, f }))
  return {
    trace: { start, windowMs: Math.max(flowEnd - start, TRACE_MS), points },
    record: recordShot(withFlow, { start, flowEnd, timerStart, timedBy }),
  }
}

/** The line under "Ready", by where the pump signal comes from. */
const READY_HINT: Record<PumpSignal, string | undefined> = {
  demo: 'Demo: the buttons below stand in for the machine.',
  sensor: undefined,
  none: 'No pump sensor: press Tare & start as you start the pump.',
}

/**
 * `performance.now()`, refreshed ten times a second while `active`, for a timer that ticks evenly. Idle, it
 * stays put and costs nothing.
 */
function useLocalNow(active: boolean): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(performance.now())
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [active])
  return now
}

/**
 * The shot time for its readout: how long the pump has run (live) or ran, or the time taken by hand. Start and
 * stop are on the readings' clock; a running time is read against this device's clock (`localNow` mapped
 * back by `clockOffset`), so it ticks evenly. With the pump's start missed there is no time to show.
 */
function shotTime(scale: Scale, localNow: number): { value: string; unit: string; note: string } {
  const { timer } = scale
  if (scale.timerMissed) return { value: '—', unit: '', note: 'Missed the start' }
  if (timer.start === null) return { value: '0.0', unit: 's', note: scale.handTimer ? 'By hand' : 'Starts with the pump' }
  const live = scale.clockOffset === null ? (scale.now ?? timer.start) : localNow - scale.clockOffset
  const end = timer.stop ?? live
  const seconds = Math.max(end - timer.start, 0) / 1000
  const running = timer.stop === null
  const note = timer.by === 'hand' ? (running ? 'Timing by hand' : 'Timed by hand') : running ? 'Pump on' : 'Pump ran'
  return { value: seconds.toFixed(1), unit: 's', note }
}

/** What the corner of the flow graph says: how to time the shot by hand, or the window it shows. */
function timerHint(scale: Scale): string {
  const { timer } = scale
  if (scale.handTimer && timer.stop === null) return timer.start === null ? 'Tap to start timer' : 'Whole shot · tap to stop'
  return timer.start !== null && timer.stop === null ? 'whole shot' : 'last 15 s'
}

/**
 * The shot card: the timer and the flow side by side over the flow graph, which shares the timer's time axis
 * (marks every 10 s from its start). With `onTap` the whole card is a button that starts or stops the hand
 * timer, pressing to the raised surface like the weight readout. Before a tare the graph holds a note instead.
 */
function ShotCard({
  trace,
  origin,
  time,
  flow,
  hint,
  tared,
  onTap,
}: {
  trace: Trace | null
  origin: number | null
  time: { value: string; unit: string; note: string }
  /** The flow to show, already formatted, or null for none. */
  flow: string | null
  hint: string
  tared: boolean
  onTap?: () => void
}) {
  const body = (
    <>
      <Row gap="md" align="end">
        <Stack gap="xs" className="min-w-0">
          <Heading role="label" as="span" tone="faint">
            Time
          </Heading>
          <Row gap="sm" align="baseline">
            <span className="text-[2.5rem] font-semibold leading-none tabular-nums text-ink">{time.value}</span>
            {time.unit ? <span className="text-xl text-ink-dim">{time.unit}</span> : null}
          </Row>
        </Stack>
        <Spacer />
        <Stack gap="xs" className="min-w-0 items-end">
          <Heading role="label" as="span" tone="faint">
            Flow
          </Heading>
          <Row gap="sm" align="baseline">
            <span className="text-[2rem] font-semibold leading-none tabular-nums text-ink">{flow ?? '—'}</span>
            {flow !== null ? <span className="text-lg text-ink-dim">g/s</span> : null}
          </Row>
        </Stack>
      </Row>
      <Row gap="sm" align="baseline">
        <Text size="xs" tone="faint">
          {time.note}
        </Text>
        <Spacer />
        <Text size="xs" tone={onTap ? 'dim' : 'faint'}>
          {hint}
        </Text>
      </Row>
      <div className="min-h-0 flex-1">
        {tared ? (
          <FlowTrace trace={trace} maxFlow={flowScaleMax(trace?.points ?? [])} origin={origin} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-card border border-dashed border-line px-4 text-center">
            <Text size="sm" tone="faint">
              Tap the weight to tare with the cup on. The flow shows from then on.
            </Text>
          </div>
        )}
      </div>
    </>
  )
  if (!onTap) {
    return (
      <Card pad="md" className="flex min-h-[9rem] flex-1 flex-col gap-1.5">
        {body}
      </Card>
    )
  }
  return (
    <Card pad="none" className="flex min-h-[9rem] flex-1 flex-col">
      <button
        type="button"
        onClick={onTap}
        aria-label={`${hint}. Time ${time.value} ${time.unit}`}
        className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-card p-3.5 text-left transition-colors duration-150 ease-out active:bg-raised"
      >
        {body}
      </button>
    </Card>
  )
}

/** The colour of the predicted finish: sage on target, clay over, plain otherwise. */
const ESTIMATE_COLOR = { on: 'text-sage', over: 'text-clay', short: 'text-ink', none: 'text-ink' } as const

/** "+1.5 g still to come · on target · 1:2.0": what the estimate adds up to. */
function estimateNote(shot: ShotReadout, target: number, dose: number): string {
  const parts = [verdictNote(shot.projected, target)]
  if (dose > 0) parts.push(`1:${(shot.projected / dose).toFixed(1)}`)
  if (!shot.settled) parts.unshift(`+${shot.stillToCome.toFixed(1)} g still to come`)
  return parts.join(' · ')
}

/** "0.4 g over target", "1.2 g short of target", or "on target". */
function verdictNote(grams: number, target: number): string {
  const state = targetState(grams, target)
  if (state === 'on') return 'on target'
  const difference = Math.abs(grams - target).toFixed(1)
  return state === 'over' ? `${difference} g over target` : `${difference} g short of target`
}

/** What the overlay says while the scale is not live, and whether reconnecting is up to the person. */
type LinkOverlay = { headline: string; detail: string; canRetry: boolean }

/**
 * The overlay for a connection state, or null when the readings are coming. Opening the connection and waiting
 * for a scale that is off are one state to the person: "Waiting for scale…". A connection that failed is an error
 * the person can do nothing about but try again, so it says so and offers a retry; one that cannot be repeated
 * (no server set) offers none.
 */
function linkOverlay(connection: ScaleConnection): LinkOverlay | null {
  switch (connection) {
    case 'live':
      return null
    case 'connecting':
    case 'waiting':
      return {
        headline: 'Waiting for scale…',
        detail: 'Make sure the scale is turned on and in range of the Bluetooth proxy. The scale will connect automatically.',
        canRetry: false,
      }
    case 'unreachable':
      return { headline: 'An unknown error occurred', detail: 'The server or Home Assistant did not answer, so the scale could not be read.', canRetry: true }
    case 'lost':
      return { headline: 'An unknown error occurred', detail: 'The readings stopped coming from the server.', canRetry: true }
    case 'unconfigured':
      return { headline: 'No server set', detail: 'The scale is read through the server. Set railsBaseUrl in config.json.', canRetry: false }
  }
}

/**
 * Covers the pull while the scale is not live, with the way through by hand. "Retry" is offered only when
 * the connection failed and trying again can help: a scale that is off needs nothing from here, Home Assistant connects it.
 */
function ScaleOverlay({ overlay, onRetry, onManual }: { overlay: LinkOverlay; onRetry: () => void; onManual: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-base/80 backdrop-blur-[2px]">
      <Card pad="lg" className="flex w-[28rem] max-w-full flex-col gap-3">
        <div role="status" aria-live="polite" className="font-display text-[2.5rem] leading-none tracking-[-0.02em] text-ink">
          {overlay.headline}
        </div>
        <Text tone="dim">{overlay.detail}</Text>
        <Row gap="sm" className="pt-2">
          <Spacer />
          {overlay.canRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          <Button variant="primary" onClick={onManual}>
            Enter by hand
          </Button>
        </Row>
      </Card>
    </div>
  )
}

/** What the card at the top says for a cue, and how it is coloured. */
function cueFor(
  cue: StopCue,
  guide: StopGuide,
  shot: ShotReadout,
  weight: number,
  target: number,
  pumpSeconds: number | null,
  pump: PumpSignal,
): Cue {
  const stopLine = `Stop at ${guide.stopAt.toFixed(1)} g · ${Math.max(guide.toGo, 0).toFixed(1)} g to go`
  switch (cue) {
    case 'idle':
      return {
        tone: 'ink',
        headline: 'Ready',
        detail: 'Tap the weight to tare with the cup on, then start the shot.',
        hint: READY_HINT[pump],
      }
    case 'keep-going':
      return shot.flowing
        ? { tone: 'ink', headline: 'Keep going', detail: stopLine }
        : { tone: 'ink', headline: 'Waiting for drops', detail: `Target ${target.toFixed(1)} g` }
    case 'get-ready':
      return { tone: 'ember', headline: 'Get ready', detail: stopLine }
    case 'stop':
      return {
        tone: 'sage',
        solid: true,
        headline: 'Stop now',
        detail: `Switch the pump off · ends near ${shot.projected.toFixed(1)} g`,
      }
    case 'late':
      return {
        tone: 'clay',
        headline: 'Too late',
        detail: `Heading for ${shot.projected.toFixed(1)} g · ${guide.off.toFixed(1)} g over target`,
      }
    case 'stopped':
      // Without a pump signal "stopped" means the flow died away, not that the pump was seen to stop.
      return { tone: 'ink', headline: pump === 'none' ? 'Flow stopped' : 'Pump off', detail: `Settling at ${shot.projected.toFixed(1)} g…` }
    case 'settled': {
      const verdict = targetState(weight, target)
      const detail = `Final ${weight.toFixed(1)} g · target ${target.toFixed(1)} g${pumpSeconds === null ? '' : ` · ${Math.round(pumpSeconds)} s`}`
      if (verdict === 'on') return { tone: 'sage', headline: 'On target', detail }
      const grams = Math.abs(weight - target).toFixed(1)
      return verdict === 'over'
        ? { tone: 'clay', headline: `${grams} g over`, detail, hint: 'Next time, stop a little sooner.' }
        : { tone: 'ember', headline: `${grams} g short`, detail, hint: 'Next time, stop a little later.' }
    }
  }
}

/**
 * One figure with its label and unit, sans semibold and tabular so it never jitters. With `onTap` the
 * whole cell is a button: it presses to the raised surface like any tappable card in the system.
 */
function Readout({
  label,
  value,
  unit,
  note,
  large,
  valueClass,
  onTap,
}: {
  label: string
  value: string
  unit: string
  note?: string
  large?: boolean
  valueClass?: string
  onTap?: () => void
}) {
  const body = (
    <Stack gap="xs" className="min-w-0 px-6 py-3.5">
      <Heading role="label" as="span" tone="faint">
        {label}
      </Heading>
      <Row gap="sm" align="baseline">
        <span className={cn('font-semibold leading-none tabular-nums', large ? 'text-[3.75rem]' : 'text-[2.75rem]', valueClass ?? 'text-ink')}>
          {value}
        </span>
        {unit ? <span className="text-xl text-ink-dim">{unit}</span> : null}
      </Row>
      <Text size="xs" tone="faint" className="min-h-4">
        {note ?? ''}
      </Text>
    </Stack>
  )
  if (!onTap) return body
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${label}: ${value} ${unit}. Tap to tare`}
      className="rounded-l-card text-left transition-colors duration-150 ease-out active:bg-raised"
    >
      {body}
    </button>
  )
}
