/**
 * Money and dates for the finance screens. Amounts arrive as whole cents (see the finance contracts),
 * so nothing here does arithmetic on floats: cents are divided only to be shown.
 */

/** "RM 1,234.56", or "-RM 1,234.56" for a negative amount. */
export function formatMoney(cents: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(cents / 100)
}

/** "RM 1,235": whole units, for tables where the cents are noise. */
export function formatMoneyShort(cents: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

/** "+RM 120" or "-RM 120": a change, with its sign always shown. */
export function formatChange(cents: number, currency = 'MYR'): string {
  return `${cents > 0 ? '+' : ''}${formatMoneyShort(cents, currency)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Nov 2026" from "2026-11". */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-')
  return `${MONTHS[Number(number) - 1] ?? number} ${year}`
}

/** "16 Nov" from "2026-11-16", with the year when it is not this year. */
export function dayLabel(date: string, today = new Date()): string {
  const [year, month, day] = date.split('-').map(Number)
  const label = `${day} ${MONTHS[month - 1] ?? month}`
  return year === today.getFullYear() ? label : `${label} ${year}`
}

/** What a recurring payment's period is called: "Monthly", "Every 3 months", "Yearly". */
export function intervalLabel(unit: 'week' | 'month' | 'year', count: number): string {
  if (count === 1) return { week: 'Weekly', month: 'Monthly', year: 'Yearly' }[unit]
  if (unit === 'month' && count === 3) return 'Quarterly'
  if (unit === 'month' && count === 6) return 'Half-yearly'
  return `Every ${count} ${unit}s`
}

/** Why a statement failed, in words for the person looking at it. */
export function statementErrorLabel(code: string | undefined): string {
  switch (code) {
    case 'unavailable':
      return 'The server has no AI model set up (GEMINI_API_KEY).'
    case 'model_failed':
      return 'The AI could not read this statement. Try again.'
    case 'bad_response':
      return 'The AI answered in a way that could not be used. Try again.'
    case 'no_transactions':
      return 'No transactions were found in this statement.'
    case 'too_long':
      return 'This statement is too long to read in one go.'
    case 'no_text':
      return 'The PDF has no text to read (a scan?).'
    default:
      return 'The statement could not be read.'
  }
}
