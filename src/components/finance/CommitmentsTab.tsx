import { AsyncScreen } from '@/components/ScreenState'
import { Badge, Card, Heading, Row, SkeletonLine, Spacer, Stack, Text } from '@/components/ui'
import type { FinanceOverview, FinanceRecurringPayment } from '@/lib/contracts'
import { fetchFinanceOverview, fetchFinanceRecurring } from '@/lib/data'
import { dayLabel, formatMoney, formatMoneyShort, intervalLabel } from '@/lib/finance-utils'
import { useResource } from '@/lib/useResource'

/**
 * What is committed each month: the total, where it goes, what falls due soon, what is about to end, and
 * every recurring payment with its period.
 */
export function CommitmentsTab() {
  const overview = useResource(() => fetchFinanceOverview(), [])
  const payments = useResource(() => fetchFinanceRecurring(), [])

  return (
    <AsyncScreen
      resource={overview}
      loadingLabel="Loading commitments"
      errorLabel="The commitments would not load"
      skeleton={<CommitmentsSkeleton />}
    >
      {(data) => (
        <AsyncScreen resource={payments} loadingLabel="Loading payments" errorLabel="The payments would not load">
          {(list) => <CommitmentsView overview={data} payments={list} />}
        </AsyncScreen>
      )}
    </AsyncScreen>
  )
}

function CommitmentsView({ overview, payments }: { overview: FinanceOverview; payments: FinanceRecurringPayment[] }) {
  const largest = Math.max(1, ...overview.byCategory.map((row) => row.monthlyCostCents))

  return (
    <div className="h-full overflow-y-auto pr-1">
      <Stack gap="xl">
        <Row gap="md" align="stretch" className="flex-wrap">
          {overview.monthlyTotals.map((total) => (
            <Card key={total.currency} pad="md" className="min-w-52">
              <Text size="xs" tone="faint" className="uppercase tracking-[0.12em]">
                Committed each month
              </Text>
              <Text className="font-display text-[1.625rem] leading-tight">{formatMoney(total.monthlyCostCents, total.currency)}</Text>
              <Text size="sm" tone="faint">
                {total.currency}, live payments only
              </Text>
            </Card>
          ))}
        </Row>

        <Section title="Where it goes">
          <Stack gap="sm">
            {overview.byCategory.map((row) => (
              <Row key={`${row.category}-${row.currency}`} gap="md">
                <Text className="w-36 shrink-0">{row.category}</Text>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-raised" aria-hidden>
                  <div className="h-full rounded-full bg-ember" style={{ width: `${(row.monthlyCostCents / largest) * 100}%` }} />
                </div>
                <Text className="w-28 shrink-0 text-right tabular-nums">{formatMoneyShort(row.monthlyCostCents, row.currency)}</Text>
              </Row>
            ))}
          </Stack>
        </Section>

        <Row gap="xl" align="start" className="flex-wrap">
          <div className="min-w-72 flex-1">
            <Section title="Due in the next 30 days">
              {overview.upcoming.length === 0 ? (
                <Text tone="faint">Nothing due.</Text>
              ) : (
                <Stack gap="xs">
                  {overview.upcoming.map((due) => (
                    <Row key={`${due.id}-${due.dueOn}`} gap="md">
                      <Text className="w-16 shrink-0" tone="dim">
                        {dayLabel(due.dueOn)}
                      </Text>
                      <Text className="flex-1">{due.name}</Text>
                      <Text className="tabular-nums">{formatMoneyShort(due.amountCents, due.currency)}</Text>
                    </Row>
                  ))}
                </Stack>
              )}
            </Section>
          </div>
          <div className="min-w-72 flex-1">
            <Section title="Ending in the next 3 months">
              {overview.ending.length === 0 ? (
                <Text tone="faint">Nothing ends soon.</Text>
              ) : (
                <Stack gap="xs">
                  {overview.ending.map((payment) => (
                    <Row key={payment.id} gap="md">
                      <Text className="w-16 shrink-0" tone="dim">
                        {payment.endsOn ? dayLabel(payment.endsOn) : ''}
                      </Text>
                      <Text className="flex-1">{payment.name}</Text>
                      <Text className="tabular-nums">{formatMoneyShort(payment.amountCents, payment.currency)}</Text>
                    </Row>
                  ))}
                </Stack>
              )}
            </Section>
          </div>
        </Row>

        <Section title="All recurring payments">
          <Stack gap="sm">
            {payments.map((payment) => (
              <Card key={payment.id} pad="md">
                <Row gap="md">
                  <Stack gap="xs" className="min-w-0 flex-1">
                    <Text>{payment.name}</Text>
                    <Text size="sm" tone="faint">
                      {[payment.category, payment.accountName, intervalLabel(payment.intervalUnit, payment.intervalCount)].filter(Boolean).join(' · ')}
                    </Text>
                  </Stack>
                  {payment.status !== 'active' ? <Badge tone={payment.status === 'cancelled' ? 'clay' : 'neutral'}>{payment.status}</Badge> : null}
                  {payment.endsOn ? <Badge>ends {dayLabel(payment.endsOn)}</Badge> : null}
                  <Spacer />
                  <Stack gap="xs" align="end">
                    <Text className="tabular-nums">{formatMoney(payment.amountCents, payment.currency)}</Text>
                    {payment.intervalCount > 1 || payment.intervalUnit !== 'month' ? (
                      <Text size="sm" tone="faint" className="tabular-nums">
                        {formatMoney(payment.monthlyCostCents, payment.currency)} a month
                      </Text>
                    ) : payment.nextDue ? (
                      <Text size="sm" tone="faint">
                        next {dayLabel(payment.nextDue)}
                      </Text>
                    ) : null}
                  </Stack>
                </Row>
              </Card>
            ))}
          </Stack>
        </Section>
      </Stack>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="md">
      <Heading role="label" as="span" tone="faint">
        {title}
      </Heading>
      {children}
    </Stack>
  )
}

function CommitmentsSkeleton() {
  return (
    <Stack gap="lg">
      <Card pad="md" className="w-56">
        <Text size="xs">
          <SkeletonLine className="w-1/2" />
        </Text>
        <Text className="text-[1.625rem]">
          <SkeletonLine className="w-3/4" />
        </Text>
      </Card>
    </Stack>
  )
}
