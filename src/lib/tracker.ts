// Relative and with the extension, not `@/lib/flow`, so this file runs under plain Node in the checks.
import {
  FLOW_ENTER,
  FLOW_EXIT,
  STABLE_ENTER_G,
  STABLE_EXIT_G,
  flowRate,
  weightRange,
  type Sample,
} from './flow.ts'

/**
 * What a scale's raw readings turn into before anything on screen looks at them. A real scale is
 * not the clean signal the sums want: it rounds to 0.1 g, the pump shakes it, drops landing in the
 * cup nudge it, a bump or a Bluetooth glitch gives an odd reading, packets go missing and arrive
 * late. So the screen never reads the raw weight or a bare slope. It reads this:
 *
 * - each reading is replaced by the median of itself and its two neighbours, which removes a single
 *   wild reading and keeps a steady climb and a real step (at the cost of one reading's delay);
 * - the flow is the scale's own when it sends one (`f`, the Timemore Dot does), averaged over the last
 *   `SCALE_FLOW_SMOOTH_MS`: the Dot's figure zigzags by 0.1 to 0.2 g/s from one reading to the next on a
 *   steady pour (its weight steps are 0.1 g). Otherwise it comes from `flowRate`, a median of slopes that
 *   a few bad readings cannot drag;
 * - `flowing` and `stable` have a gap between going on and going off (hysteresis), so a signal
 *   hovering at a threshold cannot flip them back and forth;
 * - `shown`, the weight for the number you read, holds still while nothing is flowing and the
 *   reading only flickers by a rounding step.
 *
 * Pure: give it the previous state and a reading, get the next state. The simulated scale and, later,
 * the real one both feed it, so they are filtered the same way.
 */
export type Tracker = {
  /** The last three raw readings, for the median. */
  raw: Sample[]
  /** Cleaned readings, the last three minutes (a whole shot, for its graph), oldest first. */
  samples: Sample[]
  /** The latest weight in grams, cleaned and brought up to date. This is what the stop logic uses. */
  weight: number
  /** The weight for the readout: `weight`, held steady against rounding flicker when nothing flows. */
  shown: number
  /** The flow in g/s, or null when there are too few readings to say. */
  flow: number | null
  /** The scale's own flow figures over the last `SCALE_FLOW_SMOOTH_MS`, for the average. */
  scaleFlows: Array<{ t: number; f: number }>
  flowing: boolean
  /** The weight has held still, so a shot that was stopped has finished. */
  stable: boolean
}

export const EMPTY_TRACKER: Tracker = { raw: [], samples: [], weight: 0, shown: 0, flow: null, scaleFlows: [], flowing: false, stable: false }

/** How much cleaned history is kept, in milliseconds: enough for the graph of a whole shot, and then some. */
const HISTORY_MS = 180_000

/**
 * While nothing flows, a change in the reading of this many grams or less is not shown: a scale that
 * rounds to 0.1 g flickers between two neighbouring values at rest, and that is not information.
 */
const DEAD_BAND_G = 0.15

/**
 * How far back the scale's own flow is averaged, in milliseconds: about eight of the Dot's readings. On a
 * real shot (2026-10-17) the raw figure had a spread of 0.18 g/s on a plateau, with 58 of 69 changes
 * reversing the one before; this takes most of that out, and costs about 0.4 s of delay.
 */
export const SCALE_FLOW_SMOOTH_MS = 800

const median3 = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))

export function trackerStep(previous: Tracker, reading: Sample): Tracker {
  const raw = [...previous.raw, reading].slice(-3)
  const scaleFlows =
    reading.f === undefined
      ? previous.scaleFlows
      : [...previous.scaleFlows.filter((entry) => entry.t > reading.t - SCALE_FLOW_SMOOTH_MS), { t: reading.t, f: reading.f }]
  // The median needs three readings; the first two only fill it. The cleaned reading belongs to the
  // middle one, so it is stamped with that one's time.
  if (raw.length < 3) return { ...previous, raw, scaleFlows }

  // The scale's own flow, averaged (see SCALE_FLOW_SMOOTH_MS); it needs no median delay. Without one,
  // the slope of the cleaned readings. The cleaned sample carries the averaged figure, for the graph.
  const scaleFlow = reading.f === undefined || scaleFlows.length === 0 ? undefined : scaleFlows.reduce((sum, entry) => sum + entry.f, 0) / scaleFlows.length
  const cleaned: Sample = { t: raw[1].t, g: median3(raw[0].g, raw[1].g, raw[2].g), f: scaleFlow }

  const samples = [...previous.samples.filter((sample) => sample.t > cleaned.t - HISTORY_MS), cleaned]
  const flow = scaleFlow ?? flowRate(samples, cleaned.t)
  const flowing = flow !== null && flow >= (previous.flowing ? FLOW_EXIT : FLOW_ENTER)
  const range = weightRange(samples, cleaned.t)
  const stable = range !== null && range <= (previous.stable ? STABLE_EXIT_G : STABLE_ENTER_G)
  const shown = !flowing && Math.abs(cleaned.g - previous.shown) <= DEAD_BAND_G ? previous.shown : cleaned.g

  // The median makes the cleaned reading one reading old. While coffee flows that is a fraction of a
  // gram, enough to make the stop cue late, so the weight the stop logic uses is brought up to date
  // by the flow. It is only done while flowing; at rest there is nothing to catch up on.
  const lagSeconds = (reading.t - cleaned.t) / 1000
  const weight = cleaned.g + (flowing && flow !== null && flow > 0 ? flow * lagSeconds : 0)

  return { raw, samples, weight, shown, flow, scaleFlows, flowing, stable }
}
