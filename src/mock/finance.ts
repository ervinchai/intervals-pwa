import type {
  FinanceAccount,
  FinanceBudget,
  FinanceForecast,
  FinanceForecastMonth,
  FinanceOverview,
  FinanceRecurringPayment,
  FinanceStatement,
} from '@/lib/contracts'

/**
 * Finance fixtures, with made-up figures. The forecast is worked out from the payments here, so
 * "without this payment" changes the result on mock data the way it does on the server. Shapes match
 * the contracts exactly; flipping `mockOverrides.finance` off reads the real backend.
 */

const payment = (
  id: number,
  name: string,
  amountCents: number,
  category: string,
  extra: Partial<FinanceRecurringPayment> = {},
): FinanceRecurringPayment => ({
  id,
  name,
  amountCents,
  currency: 'MYR',
  category,
  intervalUnit: 'month',
  intervalCount: 1,
  status: 'active',
  monthlyCostCents: amountCents,
  ...extra,
})

const PAYMENTS: FinanceRecurringPayment[] = [
  payment(1, 'Rent', 215_000, 'Housing', { accountName: 'HSBC Savings', nextDue: '2026-11-16' }),
  payment(2, 'Car loan', 175_100, 'Debt', { accountName: 'AmBank Savings', nextDue: '2026-11-25' }),
  payment(3, 'Balance transfer A', 197_125, 'Debt', { accountName: 'Alliance Virtual Visa', nextDue: '2026-11-24', endsOn: '2027-01-24' }),
  payment(4, 'Balance transfer B', 100_000, 'Debt', { accountName: 'Affin Credit Card', nextDue: '2026-11-12', endsOn: '2027-03-14' }),
  payment(5, 'Car insurance instalment', 28_012, 'Insurance', { accountName: 'Maybank Credit Card', nextDue: '2026-11-14', endsOn: '2027-04-14' }),
  payment(6, 'Streaming', 7_000, 'Subscriptions', {
    accountName: 'Maybank Credit Card',
    intervalCount: 3,
    monthlyCostCents: 2_333,
  }),
]

export function mockFinanceRecurring(): FinanceRecurringPayment[] {
  return PAYMENTS
}

const BUDGETS: FinanceBudget[] = [
  {
    id: 1,
    name: 'New laptop',
    targetCents: 900_000,
    currency: 'MYR',
    targetDate: '2027-03-31',
    priority: 1,
    status: 'saving',
    plannedMonthlyCents: 100_000,
    savedCents: 300_000,
    remainingCents: 600_000,
    progressPercent: 33,
    monthsLeft: 6,
    neededMonthlyCents: 100_000,
  },
  {
    id: 2,
    name: 'Sofa',
    targetCents: 400_000,
    currency: 'MYR',
    priority: 3,
    status: 'planning',
    savedCents: 0,
    remainingCents: 400_000,
    progressPercent: 0,
  },
]

export function mockFinanceBudgets(): FinanceBudget[] {
  return BUDGETS
}

const ACCOUNTS: FinanceAccount[] = [
  { id: 1, name: 'HSBC Savings', kind: 'savings', status: 'active', currency: 'MYR' },
  { id: 2, name: 'Maybank Credit Card', kind: 'credit_card', status: 'active', currency: 'MYR' },
]

export function mockFinanceAccounts(): FinanceAccount[] {
  return ACCOUNTS
}

export function mockFinanceOverview(): FinanceOverview {
  const live = PAYMENTS.filter((p) => p.status === 'active')
  const byCategory = new Map<string, number>()
  for (const p of live) byCategory.set(p.category ?? 'Other', (byCategory.get(p.category ?? 'Other') ?? 0) + p.monthlyCostCents)
  return {
    asOf: '2026-10-29',
    monthlyTotals: [{ currency: 'MYR', monthlyCostCents: live.reduce((sum, p) => sum + p.monthlyCostCents, 0) }],
    byCategory: [...byCategory].map(([category, monthlyCostCents]) => ({ category, currency: 'MYR', monthlyCostCents })).sort((a, b) => b.monthlyCostCents - a.monthlyCostCents),
    upcoming: live
      .filter((p) => p.nextDue)
      .map((p) => ({ id: p.id, name: p.name, dueOn: p.nextDue as string, amountCents: p.amountCents, currency: 'MYR', accountName: p.accountName }))
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    ending: live.filter((p) => p.endsOn && p.endsOn <= '2027-01-31'),
  }
}

const START_CENTS = 500_000
const SALARY_CENTS = 1_400_000

/** A forecast from the fixtures: salary at each month end, the payments that have not ended, no spending. */
export function mockFinanceForecast(months: number, pay: 'expected' | 'earliest', cancelIds: number[] = []): FinanceForecast {
  const payments = PAYMENTS.filter((p) => p.status === 'active' && !cancelIds.includes(p.id))
  const out: FinanceForecastMonth[] = []
  let balance = START_CENTS
  let lowest = { cents: balance, on: '2026-10-29' }
  for (let i = 0; i < months; i++) {
    const date = new Date(Date.UTC(2026, 9 + i, 1))
    const key = date.toISOString().slice(0, 7)
    const fixed = payments
      .filter((p) => i > 0 || !p.nextDue)
      .filter((p) => !p.endsOn || p.endsOn.slice(0, 7) >= key)
      .reduce((sum, p) => sum + (p.intervalCount > 1 ? p.monthlyCostCents : p.amountCents), 0)
    const opening = balance
    // Paid late in the month, or mid-month on the early end of the window: the dip before pay day is deeper late.
    const dip = opening - fixed
    balance = opening - fixed + SALARY_CENTS
    const lowestCents = pay === 'earliest' ? opening : dip
    if (lowestCents < lowest.cents) lowest = { cents: lowestCents, on: `${key}-${pay === 'earliest' ? '16' : '28'}` }
    out.push({
      month: key,
      openingCents: opening,
      incomeCents: SALARY_CENTS,
      fixedCents: fixed,
      purchasesCents: 0,
      spendingCents: 0,
      lowestCents,
      closingCents: balance,
      earmarkedCents: i === 0 ? 400_000 : 400_000 + 100_000 * i,
      freeCents: balance - (400_000 + 100_000 * i),
    })
  }
  const base = cancelIds.length ? mockFinanceForecast(months, pay) : null
  return {
    asOf: '2026-10-29',
    currency: 'MYR',
    pay,
    startingBalanceCents: START_CENTS,
    startingBalanceKnown: true,
    accountsWithoutBalance: [],
    months: out,
    lowestCents: lowest.cents,
    lowestOn: lowest.on,
    endingCents: balance,
    endingFreeCents: out[out.length - 1].freeCents,
    notes: ['Mock data: made-up figures.'],
    comparison: base
      ? {
          baselineEndingCents: base.endingCents,
          endingChangeCents: balance - base.endingCents,
          baselineLowestCents: base.lowestCents,
          lowestChangeCents: lowest.cents - base.lowestCents,
        }
      : undefined,
  }
}

const STATEMENTS: FinanceStatement[] = [
  {
    id: 1,
    accountId: 2,
    accountName: 'Maybank Credit Card',
    status: 'confirmed',
    periodStart: '2026-09-25',
    periodEnd: '2026-10-24',
    currency: 'MYR',
    openingBalanceCents: -100_000,
    closingBalanceCents: -114_850,
    reconciled: true,
    skippedDuplicates: 0,
    fileName: 'maybank-oct.pdf',
    transactionCount: 2,
    createdAt: '2026-10-25T09:00:00Z',
  },
]

export function mockFinanceStatements(): FinanceStatement[] {
  return STATEMENTS
}

/** A pretend upload: a statement in review with a few lines, kept until the page reloads. */
export function mockFinanceUpload(accountId: number, fileName: string): FinanceStatement {
  const account = ACCOUNTS.find((a) => a.id === accountId) ?? ACCOUNTS[0]
  const statement: FinanceStatement = {
    id: STATEMENTS.length + 1,
    accountId: account.id,
    accountName: account.name,
    status: 'review',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    currency: 'MYR',
    openingBalanceCents: 0,
    closingBalanceCents: -10_000,
    reconciled: true,
    skippedDuplicates: 0,
    fileName,
    transactionCount: 2,
    createdAt: new Date().toISOString(),
    transactions: [
      { id: 100 + STATEMENTS.length, postedOn: '2026-10-05', amountCents: -8_500, currency: 'MYR', description: 'TESCO KL SENTRAL', merchant: 'Tesco', kind: 'purchase', category: 'Food' },
      { id: 200 + STATEMENTS.length, postedOn: '2026-10-12', amountCents: -1_500, currency: 'MYR', description: 'GRAB*RIDE', merchant: 'Grab', kind: 'purchase', category: 'Transport' },
    ],
  }
  STATEMENTS.unshift(statement)
  return statement
}

export function mockFinanceConfirm(id: number): FinanceStatement {
  const statement = STATEMENTS.find((s) => s.id === id)
  if (!statement) throw new Error('No such statement')
  statement.status = 'confirmed'
  return statement
}
