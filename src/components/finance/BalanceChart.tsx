import type { FinanceForecastMonth } from '@/lib/contracts'
import { formatMoneyShort, monthLabel } from '@/lib/finance-utils'

const WIDTH = 720
const HEIGHT = 180
const PAD = { left: 8, right: 8, top: 12, bottom: 24 }

/**
 * The closing balance of each month (solid) and the free part of it, after what is put aside for
 * budgets (dashed). The zero line is drawn when the balance goes below it. Plain SVG: a handful of
 * points does not need a chart library.
 */
export function BalanceChart({ months, currency }: { months: FinanceForecastMonth[]; currency: string }) {
  if (months.length === 0) return null

  const values = months.flatMap((m) => [m.closingCents, m.freeCents, m.lowestCents])
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const x = (i: number) => PAD.left + (months.length === 1 ? 0 : (i * (WIDTH - PAD.left - PAD.right)) / (months.length - 1))
  const y = (cents: number) => PAD.top + ((max - cents) * (HEIGHT - PAD.top - PAD.bottom)) / (max - min)
  const line = (pick: (m: FinanceForecastMonth) => number) => months.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(pick(m)).toFixed(1)}`).join(' ')

  const summary = `Closing balance from ${formatMoneyShort(months[0].closingCents, currency)} in ${monthLabel(months[0].month)} to ${formatMoneyShort(months[months.length - 1].closingCents, currency)} in ${monthLabel(months[months.length - 1].month)}`

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-44 w-full" role="img" aria-label={summary}>
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="stroke-line" strokeWidth={1} />
      <path d={line((m) => m.closingCents)} fill="none" className="stroke-ember" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={line((m) => m.freeCents)} fill="none" className="stroke-sage" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
      {months.map((m, i) => (
        <g key={m.month}>
          <circle cx={x(i)} cy={y(m.closingCents)} r={3.5} className={m.closingCents < 0 ? 'fill-clay' : 'fill-ember'} />
          {i % Math.ceil(months.length / 6) === 0 ? (
            <text x={x(i)} y={HEIGHT - 6} textAnchor={i === 0 ? 'start' : 'middle'} className="fill-ink-faint text-[11px]">
              {monthLabel(m.month).slice(0, 3)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}
