import { useState } from 'react'

import { BudgetsTab } from '@/components/finance/BudgetsTab'
import { CommitmentsTab } from '@/components/finance/CommitmentsTab'
import { ForecastTab } from '@/components/finance/ForecastTab'
import { StatementsTab } from '@/components/finance/StatementsTab'
import { Button, Heading, Row, Stack } from '@/components/ui'

const TABS = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'commitments', label: 'Commitments' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'statements', label: 'Statements' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * Money: where the cash is heading (forecast), what is committed each month, what is being saved for,
 * and the bank statements the server reads. Each tab loads its own data when opened.
 */
export function Finance() {
  const [tab, setTab] = useState<TabId>('forecast')

  return (
    <Stack gap="lg" className="h-full">
      <Row gap="lg">
        <Heading role="hero" level={1}>
          Finance
        </Heading>
        <Row gap="sm" role="tablist" aria-label="Finance sections">
          {TABS.map((t) => (
            <Button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              size="sm"
              variant={tab === t.id ? 'select' : 'quiet'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </Row>
      </Row>

      <div className="min-h-0 flex-1">
        {tab === 'forecast' ? <ForecastTab /> : null}
        {tab === 'commitments' ? <CommitmentsTab /> : null}
        {tab === 'budgets' ? <BudgetsTab /> : null}
        {tab === 'statements' ? <StatementsTab /> : null}
      </div>
    </Stack>
  )
}
