import { useCallback, useEffect, useRef, useState } from 'react'

import { getConfig } from '@/lib/config'
import {
  ScaleCommandReplySchema,
  ScaleReadingSchema,
  ScaleSettingsReplySchema,
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
}

/**
 * How the screen stands with the server. `unconfigured`: no `railsBaseUrl`, so there is nowhere to
 * read from. `connecting`: waiting for the stream to open. `live`: readings are arriving. `lost`:
 * the stream dropped or went quiet, and a new one is tried every second.
 */
export type ScaleConnection = 'unconfigured' | 'connecting' | 'live' | 'lost'

export type Scale = ScaleState & {
  connection: ScaleConnection
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
}

/** The wait before opening the stream again after it dropped, in milliseconds. */
const RETRY_MS = 1000
/** A stream that sends nothing for this long is taken as dead. Readings come about eight a second. */
const SILENCE_MS = 3000

export function useScale(): Scale {
  const configured = Boolean(getConfig().railsBaseUrl)
  const [state, setState] = useState<ScaleState>(EMPTY_STATE)
  const [connection, setConnection] = useState<ScaleConnection>(configured ? 'connecting' : 'unconfigured')
  const [rough, setServerRough] = useState(false)
  const [tared, setTared] = useState(false)
  // Everything carried from one reading to the next, kept apart from the state the screen sees (see
  // `Tracking`). A new epoch (a tare on the server, a stream that opened again, or Reset) starts it over.
  const tracking = useRef<Tracking>(START_TRACKING)

  useEffect(() => {
    if (!configured) return
    const controller = new AbortController()
    void followScale(controller.signal, {
      onConnection: setConnection,
      onOpen: () => {
        tracking.current = { ...START_TRACKING }
      },
      onReading: (reading) => {
        tracking.current = track(tracking.current, reading)
        setState(view(tracking.current))
        setServerRough(reading.rough)
      },
    })
    return () => controller.abort()
  }, [configured])

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
    if (signal === 'none' && current.now !== null) {
      // The timer runs from the press. `keepHand` carries it over the tare's new epoch, which would
      // otherwise start everything over; set before the request, as that epoch can beat the reply.
      current.hand = { start: current.now, stop: null }
      current.keepHand = true
      setState(view(current))
    }
    void sendTare().then((accepted) => {
      const latest = tracking.current
      if (signal === 'none') {
        // On success the tare's epoch change uses up `keepHand` (the reply and that epoch's first reading
        // arrive in either order). On failure there is no new epoch: cancel the timer.
        if (!accepted) {
          latest.keepHand = false
          latest.hand = NO_SPAN
          setState(view(latest))
        }
      } else if (signal === 'demo' && accepted) {
        command('start')
      }
    })
  }, [sendTare, command])

  const tapTimer = useCallback(() => {
    const current = tracking.current
    if (current.signal !== 'none' || current.now === null) return
    const { hand } = current
    if (hand.start === null) current.hand = { start: current.now, stop: null }
    else if (hand.stop === null) current.hand = { ...hand, stop: current.now }
    else return
    setState(view(current))
  }, [])

  const reset = useCallback(() => {
    // An unknown epoch makes the next reading start everything over, as a tare does.
    tracking.current = { ...START_TRACKING }
    setTared(false)
    setState((previous) => ({ ...EMPTY_STATE, pump: previous.pump, handTimer: previous.handTimer, now: previous.now }))
  }, [])

  // The switch follows the readings, which carry the server's setting, so it shows what is true.
  const setRoughOnServer = useCallback((value: boolean) => {
    railsRequest('PATCH', '/coffee/scale', ScaleSettingsReplySchema, { rough: value }).catch((err: unknown) =>
      console.error('[intervals] scale setting failed', err),
    )
  }, [])

  return { ...state, connection, rough, setRough: setRoughOnServer, start, stopPump, tare, tared, tareAndStart, tapTimer, reset }
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

/** What the screen sees of the tracking state. */
function view(current: Tracking): ScaleState {
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
  }
}

function timePump(pump: Span, reading: ScaleReading): Span {
  if (reading.phase === 'running' && pump.start === null) return { ...pump, start: reading.t }
  if (reading.phase === 'stopped' && pump.stop === null) return { ...pump, stop: reading.t }
  return pump
}

/**
 * Reads the server's stream of readings until `signal` aborts, opening it again whenever it drops or
 * goes quiet. `EventSource` would reconnect by itself but cannot tell when a stream has gone silent.
 */
async function followScale(
  signal: AbortSignal,
  handlers: { onConnection: (connection: ScaleConnection) => void; onOpen: () => void; onReading: (reading: ScaleReading) => void },
) {
  const { railsBaseUrl } = getConfig()
  while (!signal.aborted) {
    handlers.onConnection('connecting')
    const attempt = new AbortController()
    const giveUp = () => attempt.abort()
    signal.addEventListener('abort', giveUp, { once: true })
    let watchdog = setTimeout(giveUp, SILENCE_MS)
    try {
      const res = await fetch(`${railsBaseUrl}/coffee/scale/stream`, { signal: attempt.signal })
      if (!res.ok || !res.body) throw new Error(`the scale stream answered ${res.status}`)
      handlers.onOpen()
      for await (const { event, data } of readSse(res.body)) {
        clearTimeout(watchdog)
        watchdog = setTimeout(giveUp, SILENCE_MS)
        // An `error` event is the server giving up on this stream: open a new one.
        if (event === 'error') break
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
      if (!signal.aborted) console.error('[intervals] the scale stream failed', err)
    } finally {
      clearTimeout(watchdog)
      signal.removeEventListener('abort', giveUp)
    }
    if (signal.aborted) return
    handlers.onConnection('lost')
    await pause(RETRY_MS, signal)
  }
}

/** Waits `ms`, or less if `signal` aborts first. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}
