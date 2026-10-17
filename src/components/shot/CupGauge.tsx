import { Text } from '@/components/ui'

/** The colour of the fill: it follows the cue, so the level and the panel say the same thing. */
export type GaugeTone = 'ember' | 'sage' | 'clay'

const FILL: Record<GaugeTone, string> = { ember: 'bg-ember', sage: 'bg-sage', clay: 'bg-clay' }
const GHOST: Record<GaugeTone, string> = { ember: 'bg-ember/30', sage: 'bg-sage/30', clay: 'bg-clay/30' }

/**
 * The cup as a gauge: a tall tube that fills from the bottom as the shot runs. Beside the solid
 * level, a paler stretch shows where it will end if the pump stops now. Two marks cross the tube:
 * the target, and the stop point, the weight at which switching off lets the drip land on target.
 * It mirrors what is happening in the real cup, so the level can be read without reading numbers.
 *
 * The scale tops out at the next 5 g above what has to be shown, so it only changes when the shot
 * outgrows it and does not creep while the weight rises.
 */
export function CupGauge({
  weight,
  projected,
  target,
  stopAt,
  tone,
}: {
  weight: number
  /** Where the weight ends up, or null when there is no estimate to draw. */
  projected: number | null
  target: number
  /** The weight to switch the pump off at, or null when it does not apply (no shot, no flow). */
  stopAt: number | null
  tone: GaugeTone
}) {
  const top = Math.ceil(Math.max(target * 1.15, (projected ?? 0) + 2, weight + 1) / 5) * 5
  const pct = (grams: number) => Math.min(100, Math.max(0, (grams / top) * 100))
  const ticks = Array.from({ length: top / 5 + 1 }, (_, i) => i * 5)
  const level = pct(Math.max(weight, 0))
  const ghost = projected !== null ? Math.max(pct(projected) - level, 0) : 0

  return (
    <div
      className="flex h-full min-h-0 gap-3"
      role="img"
      aria-label={`${weight.toFixed(1)} g in the cup, target ${target.toFixed(1)} g${stopAt !== null ? `, stop at ${stopAt.toFixed(1)} g` : ''}`}
    >
      {/* Ruler: a tick every 5 g, a number every 10 g. */}
      <div className="relative w-7 shrink-0" aria-hidden>
        {ticks.map((grams) => (
          <div key={grams} className="absolute right-0 flex translate-y-1/2 items-center gap-1.5" style={{ bottom: `${pct(grams)}%` }}>
            {grams % 10 === 0 ? <span className="text-[0.6875rem] tabular-nums text-ink-faint">{grams}</span> : null}
            <span className={`h-px bg-ink-faint ${grams % 10 === 0 ? 'w-2.5' : 'w-1.5'}`} />
          </div>
        ))}
      </div>

      <div className="relative w-20 shrink-0">
        <div className="absolute inset-0 overflow-hidden rounded-card border border-line bg-raised">
          <div
            className={`absolute inset-x-0 transition-[height,bottom] duration-150 ease-linear ${GHOST[tone]}`}
            style={{ bottom: `${level}%`, height: `${ghost}%` }}
          />
          <div className={`absolute inset-x-0 bottom-0 transition-[height] duration-150 ease-linear ${FILL[tone]}`} style={{ height: `${level}%` }} />
        </div>
        {/* The marks cross the tube and stick out of it on both sides, so they read as marks and not as fill. */}
        <div className="absolute -inset-x-1.5 h-0.5 bg-sage" style={{ bottom: `${pct(target)}%` }} />
        {stopAt !== null ? (
          <div className="absolute -inset-x-1.5 h-[3px] -translate-y-px bg-ink" style={{ bottom: `${pct(stopAt)}%` }} />
        ) : null}
      </div>

      {/* Labels: the target above its mark and the stop point below its own, so they can never collide
          even when they are a gram apart. */}
      <div className="relative min-w-0 flex-1" aria-hidden>
        <Text size="sm" tone="sage" className="absolute left-0 whitespace-nowrap tabular-nums" style={{ bottom: `calc(${pct(target)}% + 5px)` }}>
          Target {target.toFixed(1)} g
        </Text>
        {stopAt !== null ? (
          <Text size="sm" className="absolute left-0 whitespace-nowrap font-semibold tabular-nums" style={{ top: `calc(${100 - pct(stopAt)}% + 5px)` }}>
            Stop at {stopAt.toFixed(1)} g
          </Text>
        ) : null}
      </div>
    </div>
  )
}
