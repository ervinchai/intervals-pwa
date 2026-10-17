/**
 * Flow rate and "stop now" estimate for an espresso shot, from a scale's weight readings.
 *
 * Pure functions with no React and no clock of their own, so the numbers can be checked without
 * a browser or a scale.
 */

/**
 * One reading from the scale: grams at a moment in time, in milliseconds. `f` is the flow in g/s when the
 * scale works it out itself (the Timemore Dot does, and Home Assistant passes it on); then it is used as it
 * is, and `flowRate` is only the fallback for a scale that does not (the simulated one).
 */
export type Sample = { t: number; g: number; f?: number }

/**
 * How far back the flow rate looks. A scale reads in steps of 0.1 g, so a shorter window is
 * mostly rounding noise, and a longer one lags behind a shot that is speeding up.
 */
export const FLOW_WINDOW_MS = 1500

/** Fewer readings than this, or spread over less time, cannot tell a slope from noise. */
const MIN_SAMPLES = 4
const MIN_SPAN_MS = 500

/** Readings closer together than this are not paired for a slope: dividing by a tiny gap amplifies rounding. */
const MIN_PAIR_GAP_MS = 250

const median = (values: number[]): number => {
  const sorted = [...values].sort((x, y) => x - y)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * The flow rate in grams per second over the last `windowMs`: the median of the slopes between
 * every pair of readings that are far enough apart (the Theil-Sen estimate). It is as good as a
 * least-squares fit on a clean signal, and a few wild readings (a bump, a Bluetooth glitch, a drop
 * hitting the cup) cannot drag it, where one 2 g spike would move a least-squares slope by about
 * 0.6 g/s. It uses the readings' own timestamps, so uneven spacing and gaps are fine, and readings
 * that arrive in a bunch (the same timestamp) are simply not paired. Returns null when there are too
 * few readings to say; zero means a steady weight, and a negative value means the weight fell (the
 * cup was lifted).
 */
export function flowRate(samples: readonly Sample[], now: number, windowMs = FLOW_WINDOW_MS): number | null {
  const recent = samples.filter((sample) => sample.t > now - windowMs && sample.t <= now)
  if (recent.length < MIN_SAMPLES) return null
  if (recent[recent.length - 1].t - recent[0].t < MIN_SPAN_MS) return null

  const slopes: number[] = []
  for (let i = 0; i < recent.length; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const gap = recent[j].t - recent[i].t
      if (gap >= MIN_PAIR_GAP_MS) slopes.push(((recent[j].g - recent[i].g) / gap) * 1000)
    }
  }
  return slopes.length ? median(slopes) : null
}

/** How far the weight moved (highest minus lowest) over the last `windowMs`, or null with too few readings. */
export function weightRange(samples: readonly Sample[], now: number, windowMs = FLOW_WINDOW_MS): number | null {
  const recent = samples.filter((sample) => sample.t > now - windowMs && sample.t <= now)
  if (recent.length < MIN_SAMPLES) return null
  const weights = recent.map((sample) => sample.g)
  return Math.max(...weights) - Math.min(...weights)
}

/**
 * Grams still to come if the pump stopped right now. After the pump stops the flow dies away
 * roughly exponentially, so what is left to drip is the flow at that moment times a time
 * constant: `runOnSeconds`. That constant belongs to the machine, the basket and the puck, so it
 * is a setting to calibrate, not a fact (see `runOnFromShot`).
 */
export function runOnGrams(flow: number | null, runOnSeconds: number): number {
  return flow !== null && flow > 0 ? flow * runOnSeconds : 0
}

/** Where the weight ends up if the pump stops now. */
export function projectedFinal(weight: number, flow: number | null, runOnSeconds: number): number {
  return weight + runOnGrams(flow, runOnSeconds)
}

/**
 * The run-on constant a finished shot implies: the grams that arrived after the pump stopped,
 * divided by the flow at the moment it stopped. Averaging this over a few shots is how the
 * setting gets calibrated from real data.
 */
export function runOnFromShot(weightAtStop: number, flowAtStop: number, finalWeight: number): number | null {
  if (flowAtStop <= 0.1) return null
  return Math.max(0, finalWeight - weightAtStop) / flowAtStop
}

/** How close to the target a weight has to be to count as on target, in grams. */
export const ON_TARGET_G = 0.5

/** Where a weight stands against a target yield. */
export type TargetState = 'short' | 'on' | 'over'

export function targetState(weight: number, target: number): TargetState {
  const difference = weight - target
  if (difference > ON_TARGET_G) return 'over'
  if (difference < -ON_TARGET_G) return 'short'
  return 'on'
}

/**
 * The flow, in g/s, at which a pump that was off counts as flowing, and the lower flow at which it
 * counts as stopped again. The gap is deliberate: a signal hovering near one number must not flip
 * the state back and forth.
 */
export const FLOW_ENTER = 0.25
export const FLOW_EXIT = 0.1

/**
 * The weight counts as settled when it has moved no more than `STABLE_ENTER_G` over the last
 * `FLOW_WINDOW_MS`, and stays settled until it moves more than `STABLE_EXIT_G`. Judging the weight
 * itself, not a tiny slope, is what a noisy scale can be trusted with: a slope of 0.05 g/s is
 * smaller than the noise in a slope.
 */
export const STABLE_ENTER_G = 0.2
export const STABLE_EXIT_G = 0.3

/** `idle` before a shot, `running` while the pump is on, `stopped` after it was switched off. */
export type ShotPhase = 'idle' | 'running' | 'stopped'

/** What the shot screen shows, worked out from the scale's state. */
export type ShotReadout = {
  /** The pump is putting coffee in the cup (with a gap before it is called off, see `FLOW_ENTER`). */
  flowing: boolean
  /** The pump is off and the weight has stopped moving, so it is the result and not an estimate. */
  settled: boolean
  /** Whether the estimate has anything to say yet. */
  showEstimate: boolean
  /** The label over the estimate: what it means right now. The sparkle marks a prediction; "Final" has none, because by then it is a measurement. */
  estimateLabel: '✨ Predicted finish' | '✨ Settling at' | 'Final'
  /** Where the weight ends up: an estimate while the pump runs, the result once settled. */
  projected: number
  /** Grams still to come after the weight on the scale (0 once settled). */
  stillToCome: number
  /** How the projected weight stands against the target, or null with no target or no shot. */
  state: TargetState | null
}

/** What the scale's tracker knows, as the readout and the stop guide need it. */
export type ShotInput = {
  phase: ShotPhase
  weight: number
  flow: number | null
  /** Flowing, with hysteresis (see `FLOW_ENTER`). */
  flowing: boolean
  /** The weight is holding still, with hysteresis (see `STABLE_ENTER_G`). */
  stable: boolean
  runOn: number
  target: number | null
}

export function readShot(input: ShotInput): ShotReadout {
  const { phase, weight, flow, flowing, stable, runOn, target } = input
  const settled = phase === 'stopped' && stable
  const projected = settled ? weight : projectedFinal(weight, flow, runOn)
  return {
    flowing,
    settled,
    // Idle has nothing to estimate, and a pump that is on but not flowing yet has no flow to project.
    showEstimate: settled || phase === 'stopped' || (phase === 'running' && flowing),
    estimateLabel: settled ? 'Final' : phase === 'stopped' ? '✨ Settling at' : '✨ Predicted finish',
    projected,
    stillToCome: settled ? 0 : runOnGrams(flow, runOn),
    state: target !== null && phase !== 'idle' ? targetState(projected, target) : null,
  }
}

/**
 * How early the STOP cue fires, in seconds: the time it takes to see it and switch the pump off.
 * The cue is meant to be acted on when it appears, so it appears this long before the ideal moment.
 */
export const REACTION_S = 0.4

/** "Get ready" starts when the stop point is this many seconds away at the current flow. */
export const GET_READY_S = 2.5

/**
 * Where the shot stands against the moment to switch the pump off:
 * - `idle`: no shot yet.
 * - `keep-going`: the stop point is still far off (or no flow yet).
 * - `get-ready`: it is a couple of seconds away.
 * - `stop`: switch the pump off now. This lasts from `REACTION_S` before the ideal moment until the
 *   shot would end more than `ON_TARGET_G` over the target.
 * - `late`: the stop point has gone by; the shot is heading for more than `ON_TARGET_G` over.
 * - `stopped`: the pump is off and the drip is still settling.
 * - `settled`: the drip is over and the weight is the result.
 */
export type StopCue = 'idle' | 'keep-going' | 'get-ready' | 'stop' | 'late' | 'stopped' | 'settled'

export type StopGuide = {
  cue: StopCue
  /**
   * The weight on the scale at which to switch the pump off so the drip ends on the target. It
   * moves with the flow: the faster the flow, the earlier the stop point.
   */
  stopAt: number
  /** Grams left until `stopAt`; negative once it has passed. */
  toGo: number
  /** Where the shot ends up against the target, in grams: positive over, negative short. */
  off: number
}

export function guideStop(input: ShotInput & { target: number }): StopGuide {
  const { phase, weight, flow, flowing, stable, runOn, target } = input
  const stopAt = target - (flowing ? runOnGrams(flow, runOn) : 0)
  const toGo = stopAt - weight
  const settled = phase === 'stopped' && stable
  const off = (settled ? weight : projectedFinal(weight, flow, runOn)) - target

  const guide = (cue: StopCue): StopGuide => ({ cue, stopAt, toGo, off })
  if (phase === 'idle') return guide('idle')
  if (phase === 'stopped') return guide(settled ? 'settled' : 'stopped')
  if (!flowing || flow === null) return guide('keep-going')
  if (off > ON_TARGET_G) return guide('late')

  const secondsToStop = toGo / flow
  if (secondsToStop <= REACTION_S) return guide('stop')
  if (secondsToStop <= GET_READY_S) return guide('get-ready')
  return guide('keep-going')
}

/** The cues a running shot moves through, in order. */
const RUNNING_ORDER: StopCue[] = ['keep-going', 'get-ready', 'stop', 'late']

/** What has to be remembered between readings so the cue does not flicker. */
export type CueLatch = {
  /** The furthest cue the running shot has reached, or null before one. */
  peak: StopCue | null
  /** The weight when the drip was first judged over, or null until then. */
  finalWeight: number | null
}

export const NO_LATCH: CueLatch = { peak: null, finalWeight: null }

/**
 * Makes the cue behave like a person reading it. A shot only goes one way: once "get ready" or
 * "stop now" has shown, a wobble in the numbers must not take it back in the half second you have
 * to act on it; and once the drip is over, the result is the result, so it is frozen and stays even
 * if the weight is disturbed afterwards (the cup lifted, the scale knocked). Everything resets when the
 * scale goes back to idle (tare).
 *
 * Pure, and it returns the same `latch` object when nothing changed, so a component can store it
 * while rendering without looping.
 */
export function latchCue(
  latch: CueLatch,
  phase: ShotPhase,
  guide: StopGuide,
  weight: number,
): { latch: CueLatch; cue: StopCue; finalWeight: number } {
  if (phase === 'idle') {
    return { latch: latch.peak === null && latch.finalWeight === null ? latch : NO_LATCH, cue: guide.cue, finalWeight: weight }
  }

  if (phase === 'running') {
    const rank = RUNNING_ORDER.indexOf(guide.cue)
    const peakRank = latch.peak === null ? -1 : RUNNING_ORDER.indexOf(latch.peak)
    if (rank > peakRank) return { latch: { ...latch, peak: guide.cue }, cue: guide.cue, finalWeight: weight }
    return { latch, cue: latch.peak ?? guide.cue, finalWeight: weight }
  }

  if (latch.finalWeight !== null) return { latch, cue: 'settled', finalWeight: latch.finalWeight }
  if (guide.cue === 'settled') return { latch: { ...latch, finalWeight: weight }, cue: 'settled', finalWeight: weight }
  return { latch, cue: guide.cue, finalWeight: weight }
}

/**
 * How long the flow has to stay at nothing, in milliseconds, before the shot counts as finished. It was
 * 1 s; 5 s more (6 s) leaves time to see the final weight before the screen moves on.
 */
export const FINISH_HOLD_MS = 6000

/** A shot that never reached this many grams is not a shot (a splash, a bumped cup): never finished. */
export const MIN_SHOT_G = 5

/**
 * Without a pump signal the shot is read from the flow (`phaseFromFlow`). A flow above this, in g/s, is
 * not espresso (a shot runs at about 1 to 4 g/s) but a hand or a cup being set down, so it starts nothing.
 */
export const MAX_SHOT_FLOW = 8

/**
 * A shot read from the flow only starts on a cup that was tared: the weight when the flow is first seen
 * must be under this many grams. Setting the cup down jumps far past it, so that cannot start a shot.
 */
export const START_MAX_G = 3

/**
 * The shot's phase when the machine sends no pump signal, worked out from the flow alone. Coffee
 * flowing into a tared cup starts it (`running`); the flow dying away ends it (`stopped`), and a run
 * that stopped under `MIN_SHOT_G` was a drip, not a shot, so it goes back to `idle`. A reading gap
 * (`flow` null) is not a stop. A stopped shot stays stopped until a tare starts a new epoch, which
 * the caller handles by starting over from `idle`.
 *
 * It reads `stopped` a little late (when the drip has died away, not when the pump went off), which
 * only changes the wording of the card; the stop cue itself runs while coffee flows, as before.
 */
export function phaseFromFlow(phase: ShotPhase, input: { flowing: boolean; flow: number | null; weight: number }): ShotPhase {
  const { flowing, flow, weight } = input
  if (phase === 'idle') return flowing && flow !== null && flow <= MAX_SHOT_FLOW && weight <= START_MAX_G ? 'running' : 'idle'
  if (phase === 'running') {
    if (flowing || flow === null) return 'running'
    return weight >= MIN_SHOT_G ? 'stopped' : 'idle'
  }
  return 'stopped'
}

/** What has to be remembered between readings to tell that a shot has finished. */
export type Finish = {
  /** Coffee has flowed in this shot. Before that, a flow of nothing is just the preinfusion lull. */
  flowed: boolean
  /** When the flow was first seen at nothing since it last flowed, or null while it flows. */
  quietSince: number | null
  /** The flow has been at nothing for `FINISH_HOLD_MS`: the shot is over and the screen can move on. */
  finished: boolean
  /** The weight at that moment, or null until then. */
  finishedWeight: number | null
}

export const NOT_FINISHED: Finish = { flowed: false, quietSince: null, finished: false, finishedWeight: null }

/**
 * Tells when to move on from the shot: the flow has dropped to nothing and stayed there for
 * `FINISH_HOLD_MS` (6 s). It goes by the flow alone, so it needs no signal from the machine about the pump. It is
 * careful not to fire early:
 * - nothing counts until coffee has flowed, so the preinfusion lull cannot end the shot;
 * - a reading gap (`flow` null: too few readings to say) is not a flow of nothing, so a Bluetooth
 *   dropout mid-shot cannot end it;
 * - a flow that comes back resets the clock;
 * - a shot under `MIN_SHOT_G` is never finished;
 * - a tare (idle) starts it over.
 * Once finished it stays finished. `now` is the time of the latest reading, not the wall clock, so it
 * counts readings and not renders. Returns the same object when nothing changed, so a component can
 * store it while rendering without looping.
 */
export function trackFinish(
  previous: Finish,
  input: { phase: ShotPhase; flowing: boolean; flow: number | null; weight: number; now: number | null },
): Finish {
  const { phase, flowing, flow, weight, now } = input
  if (phase === 'idle') return previous.flowed || previous.finished || previous.quietSince !== null ? NOT_FINISHED : previous
  if (previous.finished) return previous

  let { flowed, quietSince } = previous
  if (flowing) {
    flowed = true
    quietSince = null
  } else if (flowed && flow !== null && now !== null && quietSince === null) {
    quietSince = now
  }

  const finished = flowed && quietSince !== null && now !== null && now - quietSince >= FINISH_HOLD_MS && weight >= MIN_SHOT_G
  if (flowed === previous.flowed && quietSince === previous.quietSince && !finished) return previous
  return { flowed, quietSince, finished, finishedWeight: finished ? weight : null }
}

/** One reading of a recorded shot: ms since the shot's start, grams, flow in g/s. */
export type ShotPoint = [ms: number, grams: number, flow: number]

/**
 * A shot as the scale read it, kept with its brew log for dial-in suggestions: a few figures worked out
 * from the flow, and the readings themselves. Times are seconds, flows g/s; a figure is null when the
 * shot cannot tell it (no timer: no time to the first drip).
 */
export type ShotRecord = {
  summary: {
    /** What timed the shot: the pump signal, a tap, or nothing. */
    timedBy: 'pump' | 'hand' | null
    /** From the timer's start to the first drops: the preinfusion and fill. */
    firstDripS: number | null
    /** From the first drops to the end of the flow. */
    flowS: number | null
    /** The weight gained over the flow time, per second. */
    avgFlowGs: number | null
    /** The median flow over the middle half of the flow time: the shot's plateau. */
    plateauFlowGs: number | null
    peakFlowGs: number | null
  }
  points: ShotPoint[]
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places

/**
 * The record of a shot from its readings (`t` on the readings' clock, `g`, and `f` the flow as shown), from
 * `start` to `flowEnd` (the last moment coffee flowed). `timerStart` is when the timer started, if it did.
 * Pure, for the brew log.
 */
export function recordShot(
  samples: ReadonlyArray<{ t: number; g: number; f: number }>,
  { start, flowEnd, timerStart, timedBy }: { start: number; flowEnd: number; timerStart: number | null; timedBy: 'pump' | 'hand' | null },
): ShotRecord {
  const shot = samples.filter((sample) => sample.t >= start && sample.t <= flowEnd)
  const points: ShotPoint[] = shot.map((sample) => [Math.round(sample.t - start), round(sample.g, 1), round(sample.f, 2)])
  const first = shot.find((sample) => sample.f >= FLOW_ENTER)
  const last = shot.at(-1)
  const flowS = first && last && last.t > first.t ? (last.t - first.t) / 1000 : null
  const flowing = first ? shot.filter((sample) => sample.t >= first.t) : []
  const middle = flowS !== null && first ? flowing.filter((sample) => {
    const at = (sample.t - first.t) / 1000
    return at >= flowS * 0.25 && at <= flowS * 0.75
  }) : []
  const sorted = middle.map((sample) => sample.f).sort((a, b) => a - b)
  const plateau = sorted.length ? sorted[sorted.length >> 1] : null
  return {
    summary: {
      timedBy,
      firstDripS: timerStart !== null && first ? round(Math.max(first.t - timerStart, 0) / 1000, 1) : null,
      flowS: flowS === null ? null : round(flowS, 1),
      avgFlowGs: flowS && first && last ? round((last.g - first.g) / flowS, 2) : null,
      plateauFlowGs: plateau === null ? null : round(plateau, 2),
      peakFlowGs: flowing.length ? round(Math.max(...flowing.map((sample) => sample.f)), 2) : null,
    },
    points,
  }
}
