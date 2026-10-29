import { AsyncScreen } from '@/components/ScreenState'
import { Badge, Card, Row, Spacer, Stack, Text } from '@/components/ui'
import type { FinanceBudget } from '@/lib/contracts'
import { fetchFinanceBudgets } from '@/lib/data'
import { dayLabel, formatMoney, formatMoneyShort } from '@/lib/finance-utils'
import { useResource } from '@/lib/useResource'

/** Budgets for large purchases: how much is put aside, what is left, and what to save each month. */
export function BudgetsTab() {
  const budgets = useResource(() => fetchFinanceBudgets(), [])

  return (
    <AsyncScreen
      resource={budgets}
      loadingLabel="Loading budgets"
      errorLabel="The budgets would not load"
      skeleton={<Card pad="md" className="h-32" />}
    >
      {(list) => {
        const open = list.filter((b) => b.status === 'planning' || b.status === 'saving')
        const done = list.filter((b) => b.status === 'bought' || b.status === 'dropped')
        return (
          <div className="h-full overflow-y-auto pr-1">
            <Stack gap="lg">
              {open.length === 0 ? <Text tone="faint">No purchases are being saved for.</Text> : null}
              {open.map((budget) => (
                <BudgetCard key={budget.id} budget={budget} />
              ))}
              {done.length > 0 ? (
                <Stack gap="sm">
                  <Text size="sm" tone="faint">
                    Done
                  </Text>
                  {done.map((budget) => (
                    <BudgetCard key={budget.id} budget={budget} />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </div>
        )
      }}
    </AsyncScreen>
  )
}

function BudgetCard({ budget }: { budget: FinanceBudget }) {
  const money = (cents: number) => formatMoneyShort(cents, budget.currency)

  return (
    <Card pad="lg">
      <Stack gap="md">
        <Row gap="md">
          <Text className="font-display text-[1.25rem]">{budget.name}</Text>
          <Badge tone={budget.status === 'saving' ? 'ember' : budget.status === 'bought' ? 'sage' : 'neutral'}>{budget.status}</Badge>
          {budget.targetDate ? <Badge>by {dayLabel(budget.targetDate)}</Badge> : null}
          <Spacer />
          <Text className="tabular-nums">{formatMoney(budget.targetCents, budget.currency)}</Text>
        </Row>

        <div
          className="h-3 overflow-hidden rounded-full bg-raised"
          role="progressbar"
          aria-valuenow={budget.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${budget.name}: ${budget.progressPercent}% saved`}
        >
          <div className="h-full rounded-full bg-ember" style={{ width: `${budget.progressPercent}%` }} />
        </div>

        <Row gap="lg" className="flex-wrap">
          <Text size="sm" tone="dim">
            {money(budget.savedCents)} put aside · {money(budget.remainingCents)} to go
          </Text>
          {budget.neededMonthlyCents !== undefined && budget.monthsLeft ? (
            <Text size="sm" tone="dim">
              {money(budget.neededMonthlyCents)} a month for {budget.monthsLeft} month(s)
            </Text>
          ) : null}
          {budget.plannedMonthlyCents ? (
            <Text size="sm" tone="faint">
              plan: {money(budget.plannedMonthlyCents)} a month
            </Text>
          ) : null}
        </Row>
      </Stack>
    </Card>
  )
}

