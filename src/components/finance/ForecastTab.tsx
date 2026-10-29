import { useState } from 'react'

import { BalanceChart } from '@/components/finance/BalanceChart'
import { AsyncScreen } from '@/components/ScreenState'
import { Badge, Button, Card, Row, SkeletonLine, Spacer, Stack, Text } from '@/components/ui'
import type { FinanceForecast } from '@/lib/contracts'
import { fetchFinanceForecast, fetchFinanceRecurring } from '@/lib/data'
import { dayLabel, formatChange, formatMoneyShort, monthLabel } from '@/lib/finance-utils'
import { useResource } from '@/lib/useResource'

/**
 * Where the cash is heading if things carry on as they are: a balance line, a month-by-month table,
 * the lowest point, and a what-if ("without this payment") that is never saved.
 */
export function ForecastTab() {
  const [months, setMonths] = useState(12)
  const [pay, setPay] = useState<'expected' | 'earliest'>('expected')
  const [without, setWithout] = useState<number[]>([])
  const forecast = useResource(
    () => fetchFinanceForecast({ months, pay, cancelPaymentIds: without }),
    [months, pay, without.join(',')],
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <Row gap="sm" className="flex-wrap">
        {[6, 12].map((n) => (
          <Button key={n} size="sm" variant={months === n ? 'select' : 'quiet'} onClick={() => setMonths(n)}>
            {n} months
          </Button>
        ))}
        <span className="mx-2 h-6 w-px bg-line" aria-hidden />
        <Button size="sm" variant={pay === 'expected' ? 'select' : 'quiet'} onClick={() => setPay('expected')}>
          Pay late in the month
        </Button>
        <Button size="sm" variant={pay === 'earliest' ? 'select' : 'quiet'} onClick={() => setPay('earliest')}>
          Pay early
        </Button>
      </Row>

      <WhatIf without={without} onChange={setWithout} />

      <div className="min-h-0 flex-1">
        <AsyncScreen
          resource={forecast}
          loadingLabel="Working out the forecast"
          errorLabel="The forecast would not load"
          skeleton={<ForecastSkeleton />}
        >
          {(data) => <ForecastView forecast={data} />}
        </AsyncScreen>
      </div>
    </div>
  )
}

/** Pick recurring payments to leave out, to see what the months would look like. */
function WhatIf({ without, onChange }: { without: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false)
  const payments = useResource(() => (open ? fetchFinanceRecurring() : Promise.resolve([])), [open])

  const toggle = (id: number) => onChange(without.includes(id) ? without.filter((x) => x !== id) : [...without, id])

  return (
    <Stack gap="sm">
      <Row gap="sm">
        <Button size="sm" variant={open || without.length > 0 ? 'select' : 'quiet'} onClick={() => setOpen(!open)}>
          What if I stop…
          {without.length > 0 ? ` (${without.length})` : ''}
        </Button>
        {without.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Clear
          </Button>
        ) : null}
      </Row>
      {open && payments.status === 'ready' ? (
        <Row gap="sm" className="flex-wrap">
          {payments.data
            .filter((p) => p.status === 'active' || p.status === 'trial')
            .map((p) => (
              <Button key={p.id} size="sm" variant={without.includes(p.id) ? 'select' : 'quiet'} onClick={() => toggle(p.id)}>
                {p.name} · {formatMoneyShort(p.amountCents, p.currency)}
              </Button>
            ))}
        </Row>
      ) : null}
    </Stack>
  )
}

function ForecastView({ forecast }: { forecast: FinanceForecast }) {
  const money = (cents: number) => formatMoneyShort(cents, forecast.currency)
  const negative = forecast.firstNegativeOn !== undefined

  return (
    <div className="h-full overflow-y-auto pr-1">
      <Stack gap="lg">
        {forecast.comparison ? (
          <Card pad="md" className="border-ember/40">
            <Text size="sm">
              Without those payments you would end {formatChange(forecast.comparison.endingChangeCents, forecast.currency)} better off, and the
              lowest point would move {formatChange(forecast.comparison.lowestChangeCents, forecast.currency)}.
            </Text>
          </Card>
        ) : null}

        {negative ? (
          <Card pad="md" className="border-clay/50">
            <Text size="sm">
              The balance goes below zero on {dayLabel(forecast.firstNegativeOn as string)}. The lowest point is{' '}
              {money(forecast.lowestCents)} on {dayLabel(forecast.lowestOn)}.
            </Text>
          </Card>
        ) : null}

        <Row gap="md" align="stretch" className="flex-wrap">
          <Figure label="Starting balance" value={money(forecast.startingBalanceCents)} note={forecast.startingBalanceKnown ? undefined : 'not set yet'} />
          <Figure label="Lowest point" value={money(forecast.lowestCents)} note={dayLabel(forecast.lowestOn)} bad={forecast.lowestCents < 0} />
          <Figure label={`In ${monthLabel(forecast.months[forecast.months.length - 1].month)}`} value={money(forecast.endingCents)} note={`${money(forecast.endingFreeCents)} free`} />
          {forecast.spendingEstimate ? (
            <Figure label="Everyday spending" value={money(forecast.spendingEstimate.monthlyCents)} note={`a month, from ${forecast.spendingEstimate.basedOnMonths} month(s) of statements`} />
          ) : null}
        </Row>

        <Card pad="md">
          <BalanceChart months={forecast.months} currency={forecast.currency} />
          <Row gap="md" className="mt-1">
            <Badge tone="ember">Balance</Badge>
            <Badge tone="sage">Free after savings goals</Badge>
          </Row>
        </Card>

        <Card pad="md" className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[0.9375rem] tabular-nums">
            <thead>
              <tr className="text-ink-faint">
                <Th>Month</Th>
                <Th right>In</Th>
                <Th right>Fixed</Th>
                <Th right>Spending</Th>
                <Th right>Purchases</Th>
                <Th right>Lowest</Th>
                <Th right>End</Th>
                <Th right>Free</Th>
              </tr>
            </thead>
            <tbody>
              {forecast.months.map((m) => (
                <tr key={m.month} className="border-t border-line">
                  <td className="py-2 pr-3">{monthLabel(m.month)}</td>
                  <Td>{money(m.incomeCents)}</Td>
                  <Td>{money(m.fixedCents)}</Td>
                  <Td>{m.spendingCents ? money(m.spendingCents) : '–'}</Td>
                  <Td>{m.purchasesCents ? money(m.purchasesCents) : '–'}</Td>
                  <Td bad={m.lowestCents < 0}>{money(m.lowestCents)}</Td>
                  <Td bad={m.closingCents < 0}>{money(m.closingCents)}</Td>
                  <Td bad={m.freeCents < 0}>{money(m.freeCents)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {forecast.accountsWithoutBalance.length > 0 || forecast.notes.length > 0 ? (
          <Stack gap="xs">
            {forecast.notes.map((note) => (
              <Text key={note} size="sm" tone="faint">
                {note}
              </Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </div>
  )
}

function Figure({ label, value, note, bad }: { label: string; value: string; note?: string; bad?: boolean }) {
  return (
    <Card pad="md" className="min-w-44 flex-1">
      <Text size="xs" tone="faint" className="uppercase tracking-[0.12em]">
        {label}
      </Text>
      <Text className={`font-display text-[1.625rem] leading-tight ${bad ? 'text-clay' : ''}`}>{value}</Text>
      {note ? (
        <Text size="sm" tone="faint">
          {note}
        </Text>
      ) : null}
    </Card>
  )
}

function Th({ children, right }: { children: string; right?: boolean }) {
  return <th className={`pb-2 pr-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] ${right ? 'text-right' : ''}`}>{children}</th>
}

function Td({ children, bad }: { children: string; bad?: boolean }) {
  return <td className={`py-2 pr-3 text-right ${bad ? 'text-clay' : ''}`}>{children}</td>
}

function ForecastSkeleton() {
  return (
    <Stack gap="lg">
      <Row gap="md">
        {[0, 1, 2].map((i) => (
          <Card key={i} pad="md" className="flex-1">
            <Text size="xs">
              <SkeletonLine className="w-1/2" />
            </Text>
            <Text className="text-[1.625rem]">
              <SkeletonLine className="w-3/4" />
            </Text>
          </Card>
        ))}
        <Spacer />
      </Row>
      <Card pad="md" className="h-52" />
    </Stack>
  )
}
