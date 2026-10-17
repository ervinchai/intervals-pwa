import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { getConfig } from '@/lib/config'
import {
  ScaleCommandReplySchema,
  ScaleReadingSchema,
  ScaleSettingsReplySchema,
  ScaleStatusSchema,
  type PumpSignal,
  type ScaleCommand,
  type ScaleReading,
} from '@/lib/contracts'
import { phaseFromFlow, type Sample, type ShotPhase } from '@/lib/flow'
import { railsRequest } from '@/lib/rails'
import { readSse } from '@/lib/sse'
import { EMPTY_TRACKER, trackerStep, type Tracker } from '@/lib/tracker'

/**
 * The scale as the screens see it, after the readings have been cleaned (see `trackerStep`). The
 * readings come from Rails (`GET /coffee/scale/stream`): either a pretend machine that plays a believable
 * shot, or the real Timemore Dot through Home Assistant. Both arrive in the same shape and go through the
 * same tracker; `pump` says where the shot's phase comes from.
 */
export type ScaleState = {
  /**
   * `idle` before a shot, `running` while the pump is on, `stopped` after it was switched off. With no pump
   * signal (`pump` is `none`) it is read from the flow instead (`phaseFromFlow`): running while coffee flows.
   */
  phase: ShotPhase
  /** Where the phase comes from: the demo buttons, a pump sensor, or nothing (then the flow). */
  pump: PumpSignal
  /** Cleaned readings, oldest first, the last three minutes. */
  samples: Sample[]
  /** The latest cleaned weight in grams, after tare. The stop logic uses this one. */
  weight: number
  /** The weight for the number on screen: it holds still against rounding flicker when nothing flows. */
  shown: number
  /** The flow rate in g/s (the scale's own, or estimated), or null when it cannot be told yet. */
  flow: number | null
  /** Coffee is flowing (with a gap between going on and going off, so noise cannot flip it). */
  flowing: boolean
  /** The weight has held still: a shot that was stopped has finished. */
  stable: boolean
  /** The latest reading's time, in the readings' own milliseconds. */
  now: number | null
  /** The time of the last cleaned reading at which coffee was flowing, or null before any flowed. */
  flowEnd: number | null
  /**
   * The shot clock, in the readings' own milliseconds. `by` says what started it: `pump` (the pump signal,
   * from switching on to switching off: the shot time as a recipe means it) or `hand` (a tap, with no pump
   * sensor; it stops at a second tap or when the flow dies away). A running shot's time is `now - start`.
   */
  timer: { start: number | null; stop: number | null; by: 'pump' | 'hand' | null }
  /** The pump was already on when the readings started (the stream opened mid-shot): its time would read short. */
  timerMissed: boolean
  /** The timer can be started and stopped by hand (there is no pump signal to do it). */
  handTimer: boolean
  /** The finished shot's time in seconds, for the brew log; null until the timer has stopped. */
  shotSeconds: number | null
  /**
   * This device's clock minus the readings' clock, in ms (`performance.now()` = reading time + offset), or
   * null before the first reading. A running timer is shown on this device's clock with it, so it ticks
   * evenly instead of jumping with each reading's arrival.
   */
  clockOffset: number | null
}

/**
 * How the screen stands with the scale, as the stream says it. `unconfigured`: no `railsBaseUrl`, so there is
 * nowhere to read from. `connecting`: the stream is opening. `waiting`: the stream is open but the scale is not
 * connected (off, asleep, away); Home Assistant connects it by itself when it wakes, and the stream stays open,
 * so this turns into `live` with no action. `live`: readings are arriving. `unreachable` (the server or Home
 * Assistant could not be reached) and `lost` (the stream stopped) are where the stream ended; they stay until
 * `retry`, because nothing on the scale's side would bring the stream back. Nothing is retried by itself, so
 * the screen never flickers between states.
 */
export type ScaleConnection = 'unconfigured' | 'connecting' | 'waiting' | 'live' | 'unreachable' | 'lost'

export type Scale = ScaleState & {
  connection: ScaleConnection
  /** Open the stream again, once: for after the server dropped it (`unreachable`, `lost`). */
  retry: () => void
  /** Whether the simulated scale is behaving like a rough one (see Rails `Coffee::Scale::Curve`). */
  rough: boolean
  setRough: (rough: boolean) => void
  /** Start the pump of the simulated machine (demo only; the real scale refuses). */
  start: () => void
  /** Stop the pump of the simulated machine (demo only). */
  stopPump: () => void
  /** Zero the scale at the current weight. */
  tare: () => void
  /**
   * A tare from this screen has been acknowledged since it opened (or since Reset). Until then the flow is
   * not shown: the cup is not zeroed, so nothing the scale says is a shot yet.
   */
  tared: boolean
  /**
   * Tare and start the timer in one tap. With no pump signal the hand timer starts at once, at the press, and
   * keeps running through the tare's new epoch; the weight counts from zero once the tare lands. If the tare
   * fails the timer is cancelled. In the demo it tares, then starts the simulated pump.
   */
  tareAndStart: () => void
  /** With `handTimer`: start the timer now, or stop it if it runs. Does nothing once it has stopped. */
  tapTimer: () => void
  /** Start the shot over on screen (flow trace, timer, phase, `tared`); the scale itself is left alone. */
  reset: () => void
}

const EMPTY_STATE: ScaleState = {
  phase: 'idle',
  pump: 'demo',
  samples: [],
  weight: 0,
  shown: 0,
  flow: null,
  flowing: false,
  stable: false,
  now: null,
  flowEnd: null,
  timer: { start: null, stop: null, by: null },
  timerMissed: false,
  handTimer: false,
  shotSeconds: null,
  clockOffset: null,
}

/**
 * A stream that sends nothing at all for this long is taken as dead. The server sends a reading ten times
 * a second, and a `: ping` every second while the scale is quiet, so only a dead server or network goes
 * this long without a word. The first bytes get longer: the server opens Home Assistant's socket first.
 */
const SILENCE_MS = 5000
const FIRST_BYTES_MS = 10_000

export function useScale(): Scale {
  const configured = Boolean(getConfig().railsBaseUrl)
  const [state, setState] = useState<ScaleState>(EMPTY_STATE)
  const [connection, setConnection] = useState<ScaleConnection>(configured ? 'connecting' : 'unconfigured')
  // Bumped by `retry` to open the stream once more.
  const [attempt, setAttempt] = useState(0)
  // The stream is open only while this screen is mounted and the page is visible: leaving the espresso
  // screen (unmount) or hiding the app (screen off, another app) closes it, so the server lets go of Home
  // Assistant. Showing the page again opens it once.
  const visible = usePageVisible()
  const [rough, setServerRough] = useState(false)
  const [tared, setTared] = useState(false)
  // Everything carried from one reading to the next, kept apart from the state the screen sees (see
  // `Tracking`). A new epoch (a tare on the server, a stream that opened again, or Reset) starts it over.
  const tracking = useRef<Tracking>(START_TRACKING)
  // The readings' clock against this device's, fitted from each reading's arrival (see `fitClock`).
  const clock = useRef<ClockFit>(NO_CLOCK)
  // "Now" on the readings' clock, from this device's clock: exact to the moment, not to the last reading.
  const scaleNow = useCallback((): number | null => {
    const { offset } = clock.current
    return offset === null ? tracking.current.now : performance.now() - offset
  }, [])

  useEffect(() => {
    if (!configured || !visible) return
    const controller = new AbortController()
    void followScale(controller.signal, {
      onConnection: setConnection,
      onOpen: () => {
        tracking.current = { ...START_TRACKING }
      },
      onReading: (reading) => {
        clock.current = fitClock(clock.current, performance.now() - reading.t)
        tracking.current = track(tracking.current, reading)
        setState(view(tracking.current, clock.current.offset))
        setServerRough(reading.rough)
      },
    })
    return () => controller.abort()
  }, [configured, visible, attempt])

  const retry = useCallback(() => {
    setConnection('connecting')
    setAttempt((previous) => previous + 1)
  }, [])

  const command = useCallback((name: ScaleCommand) => {
    railsRequest('POST', '/coffee/scale/commands', ScaleCommandReplySchema, { command: name }).catch((err: unknown) =>
      console.error(`[intervals] scale command ${name} failed`, err),
    )
  }, [])
  const start = useCallback(() => command('start'), [command])
  const stopPump = useCallback(() => command('stop_pump'), [command])
  // A tare, marking the screen tared once the scale acknowledges it. Resolves to whether it did.
  const sendTare = useCallback(
    () =>
      railsRequest('POST', '/coffee/scale/commands', ScaleCommandReplySchema, { command: 'tare' })
        .then((reply) => {
          if (reply.accepted) setTared(true)
          return reply.accepted
        })
        .catch((err: unknown) => {
          console.error('[intervals] scale command tare failed', err)
          return false
        }),
    [],
  )
  const tare = useCallback(() => void sendTare(), [sendTare])

  const tareAndStart = useCallback(() => {
    const current = tracking.current
    const { signal } = current
    const pressed = scaleNow()
    if (signal === 'none' && pressed !== null) {
      // The timer runs from the press. `keepHand` carries it over the tare's new epoch, which would
      // otherwise start everything over; set before the request, as that epoch can beat the reply.
      current.hand = { start: pressed, stop: null }
      current.keepHand = true
      setState(view(current, clock.current.offset))
    }
    void sendTare().then((accepted) => {
      const latest = tracking.current
      if (signal === 'none') {
        // On success the tare's epoch change uses up `keepHand` (the reply and that epoch's first reading
        // arrive in either order). On failure there is no new epoch: cancel the timer.
        if (!accepted) {
          latest.keepHand = false
          latest.hand = NO_SPAN
          setState(view(latest, clock.current.offset))
        }
      } else if (signal === 'demo' && accepted) {
        command('start')
      }
    })
  }, [sendTare, command, scaleNow])

  const tapTimer = useCallback(() => {
    const current = tracking.current
    const now = scaleNow()
    if (current.signal !== 'none' || now === null) return
    const { hand } = current
    if (hand.start === null) current.hand = { start: now, stop: null }
    else if (hand.stop === null) current.hand = { ...hand, stop: Math.max(now, hand.start) }
    else return
    setState(view(current, clock.current.offset))
  }, [scaleNow])

  const reset = useCallback(() => {
    // An unknown epoch makes the next reading start everything over, as a tare does.
    tracking.current = { ...START_TRACKING }
    setTared(false)
    setState((previous) => ({ ...EMPTY_STATE, pump: previous.pump, handTimer: previous.handTimer, now: previous.now, clockOffset: previous.clockOffset }))
  }, [])

  // The switch follows the readings, which carry the server's setting, so it shows what is true.
  const setRoughOnServer = useCallback((value: boolean) => {
    railsRequest('PATCH', '/coffee/scale', ScaleSettingsReplySchema, { rough: value }).catch((err: unknown) =>
      console.error('[intervals] scale setting failed', err),
    )
  }, [])

  return { ...state, connection, retry, rough, setRough: setRoughOnServer, start, stopPump, tare, tared, tareAndStart, tapTimer, reset }
}

/** When something went on and off, in the readings' own milliseconds. */
type Span = { start: number | null; stop: number | null }
const NO_SPAN: Span = { start: null, stop: null }

/**
 * What is carried from one reading to the next. `pump` times the pump from the readings' own phase and clock
 * (`pumpMissed`: it was already on when the readings began). `flowPhase` is the phase read from the flow, for
 * a scale with no pump signal, and `hand` the timer started by a tap there. `flowEnd` is the last time
 * coffee flowed. `phase`, `signal` and `now` are the latest reading's. `keepHand`: Tare & start started the hand
 * timer and is waiting for the tare, so the tare's new epoch keeps that timer instead of clearing it.
 */
type Tracking = {
  tracker: Tracker
  epoch: number | null
  pump: Span
  pumpMissed: boolean
  flowPhase: ShotPhase
  hand: Span
  flowEnd: number | null
  phase: ShotPhase
  signal: PumpSignal
  now: number | null
  keepHand: boolean
}
const START_TRACKING: Tracking = {
  tracker: EMPTY_TRACKER,
  epoch: null,
  pump: NO_SPAN,
  pumpMissed: false,
  flowPhase: 'idle',
  hand: NO_SPAN,
  flowEnd: null,
  phase: 'idle',
  signal: 'demo',
  now: null,
  keepHand: false,
}

/** The next tracking state after a reading. Pure. */
function track(previous: Tracking, reading: ScaleReading): Tracking {
  let current = previous
  if (current.epoch !== reading.epoch) {
    // A new weighing. A shot already under way when the first reading arrives had its start missed.
    // Tare & start: the timer started at the press runs on through the tare (the clock is the same).
    const hand = previous.keepHand && reading.pump === 'none' ? previous.hand : NO_SPAN
    current = { ...START_TRACKING, epoch: reading.epoch, pumpMissed: reading.phase !== 'idle', hand }
  }
  const pump = timePump(current.pump, reading)
  const tracker = trackerStep(current.tracker, { t: reading.t, g: reading.g, f: reading.flow ?? undefined })
  const { flowing, flow, weight, samples } = tracker
  const flowEnd = flowing ? (samples.at(-1)?.t ?? current.flowEnd) : current.flowEnd

  let { flowPhase, hand } = current
  let phase = reading.phase
  if (reading.pump === 'none') {
    flowPhase = phaseFromFlow(current.flowPhase, { flowing, flow, weight })
    phase = flowPhase
    // A timer started by hand stops when the flow dies away, at the last moment coffee flowed.
    if (current.flowPhase === 'running' && flowPhase === 'stopped' && hand.start !== null && hand.stop === null) {
      hand = { ...hand, stop: Math.max(flowEnd ?? reading.t, hand.start) }
    }
  }
  return { ...current, tracker, pump, flowPhase, hand, flowEnd, phase, signal: reading.pump, now: reading.t }
}

/**
 * The offset between this device's clock and the readings' (`performance.now()` minus the reading's `t`),
 * taken as the smallest arrival offset over the last `CLOCK_WINDOW` readings: the reading that came through
 * fastest carries the least network delay. A window, not all time, so slow drift between the clocks is
 * followed.
 */
type ClockFit = { offsets: number[]; offset: number | null }
const NO_CLOCK: ClockFit = { offsets: [], offset: null }
const CLOCK_WINDOW = 50

function fitClock(previous: ClockFit, arrivalOffset: number): ClockFit {
  const offsets = [...previous.offsets, arrivalOffset].slice(-CLOCK_WINDOW)
  return { offsets, offset: Math.min(...offsets) }
}

/** What the screen sees of the tracking state. */
function view(current: Tracking, clockOffset: number | null): ScaleState {
  const { samples, weight, shown, flow, flowing, stable } = current.tracker
  const byPump = current.signal !== 'none' && !current.pumpMissed && current.pump.start !== null
  const byHand = current.signal === 'none' && current.hand.start !== null
  const span = byPump ? current.pump : byHand ? current.hand : NO_SPAN
  const shotSeconds = span.start !== null && span.stop !== null ? (span.stop - span.start) / 1000 : null
  return {
    phase: current.phase,
    pump: current.signal,
    samples,
    weight,
    shown,
    flow,
    flowing,
    stable,
    now: current.now,
    flowEnd: current.flowEnd,
    timer: { ...span, by: byPump ? 'pump' : byHand ? 'hand' : null },
    timerMissed: current.signal !== 'none' && current.pumpMissed,
    handTimer: current.signal === 'none',
    shotSeconds,
    clockOffset,
  }
}

function timePump(pump: Span, reading: ScaleReading): Span {
  if (reading.phase === 'running' && pump.start === null) return { ...pump, start: reading.t }
  if (reading.phase === 'stopped' && pump.stop === null) return { ...pump, stop: reading.t }
  return pump
}

/**
 * Reads the server's stream of readings once, until it ends or `signal` aborts. The stream stays open while
 * the scale is off (`waiting`, from its `status` events), so the scale coming and going needs nothing here.
 * When the stream itself ends it says why (`unreachable`, or `lost` when it stopped or went silent) and does
 * not open a new one; `retry` does, when the person asks. `EventSource` would reconnect on its own, which is
 * the flicker this avoids.
 */
async function followScale(
  signal: AbortSignal,
  handlers: { onConnection: (connection: ScaleConnection) => void; onOpen: () => void; onReading: (reading: ScaleReading) => void },
) {
  const { railsBaseUrl } = getConfig()
  handlers.onConnection('connecting')
  const attempt = new AbortController()
  const giveUp = () => attempt.abort()
  signal.addEventListener('abort', giveUp, { once: true })
  let watchdog = setTimeout(giveUp, FIRST_BYTES_MS)
  const heard = () => {
    clearTimeout(watchdog)
    watchdog = setTimeout(giveUp, SILENCE_MS)
  }
  let ending: ScaleConnection = 'lost'
  let answered = false
  try {
    const res = await fetch(`${railsBaseUrl}/coffee/scale/stream`, { signal: attempt.signal })
    answered = true
    if (!res.ok || !res.body) {
      ending = 'unreachable'
      throw new Error(`the scale stream answered ${res.status}`)
    }
    handlers.onOpen()
    heard()
    for await (const { event, data } of readSse(res.body, { onActivity: heard })) {
      if (event === 'error') {
        // The server's only error here is that it or Home Assistant could not be reached.
        ending = 'unreachable'
        break
      }
      if (event === 'status') {
        const parsed = ScaleStatusSchema.safeParse(JSON.parse(data))
        // Not connected: waiting for the scale. Connected: the first reading is a moment away, and it says "live".
        if (parsed.success && !parsed.data.connected) handlers.onConnection('waiting')
        continue
      }
      if (event !== 'reading') continue
      const parsed = ScaleReadingSchema.safeParse(JSON.parse(data))
      if (!parsed.success) {
        console.error('[intervals] a scale reading failed its contract', parsed.error.issues)
        continue
      }
      handlers.onConnection('live')
      handlers.onReading(parsed.data)
    }
  } catch (err) {
    if (!signal.aborted) {
      console.error('[intervals] the scale stream failed', err)
      // No answer at all (the server is down or unreachable) is "unreachable"; a stream cut off later is "lost".
      if (!answered) ending = 'unreachable'
    }
  } finally {
    clearTimeout(watchdog)
    signal.removeEventListener('abort', giveUp)
  }
  if (!signal.aborted) handlers.onConnection(ending)
}

/** Whether the page is visible (not a hidden tab, a locked screen, or an app in the background). */
function usePageVisible(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
    () => document.visibilityState === 'visible',
  )
}
