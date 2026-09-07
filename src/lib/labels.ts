import type { CoffeeBean, CoffeeBeanSummary } from '@/lib/contracts'
import type { LabelInput, RichText, StyledRun } from '@/lib/label'

/**
 * View-specific label builders.
 *
 * Each view that can print turns its own data into a {@link LabelInput} here —
 * the QR payload plus a {@link RichText} caption whose line/weight choices are
 * that view's label layout. Keeping them in one module (rather than inline in
 * screens) makes the label designs easy to find and tweak side by side, while
 * the print flow stays generic.
 */

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const

/**
 * Formats a roast date into uppercase display e.g. "20 SEP 2026".
 * Handles ISO strings (2026-09-20), partial labels (20 Sep), or existing formatted dates.
 */
function formatRoastDate(dateStr?: string | null): string | undefined {
  if (!dateStr) return undefined
  const trimmed = dateStr.trim()
  if (!trimmed) return undefined

  // Match ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const month = MONTH_NAMES[parseInt(m, 10) - 1]
    const day = parseInt(d, 10)
    return `${day} ${month} ${y}`
  }

  // Match "20 Sep 2026", "20 September 2026", or "20 Sep" (infers current year)
  const textMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/)
  if (textMatch) {
    const [, d, m, y] = textMatch
    const year = y ?? new Date().getFullYear()
    const month = m.slice(0, 3).toUpperCase()
    return `${parseInt(d, 10)} ${month} ${year}`
  }

  return trimmed.toUpperCase()
}

/** A single styled run, defaulting to plain weight. */
function run(text: string, style: Partial<Omit<StyledRun, 'text'>> = {}): StyledRun {
  return { text, bold: false, italic: false, underline: false, ...style }
}

/** Assembles paragraphs, dropping any that are empty/undefined. */
function lines(...paragraphs: (StyledRun[] | null | undefined)[]): RichText {
  return paragraphs.filter((p): p is StyledRun[] => !!p && p.length > 0)
}

/**
 * The jar label for a coffee bean: its QR (`intervals://bean/<id>`) over a
 * structured caption:
 *   1. bean ID (bold)
 *   2. bean name (bold)
 *   3. —— (divider)
 *   4. roast level (e.g. Medium, Dark, Medium-Light)
 *   5. roast date (e.g. 20 SEP 2026)
 *   6. —— (divider)
 *   7. roaster name
 */
export function beanLabel(bean: CoffeeBean | CoffeeBeanSummary): LabelInput {
  const roastDate = formatRoastDate(bean.roastDateLabel)
  const hasRoastInfo = Boolean(bean.roastLevel || roastDate)

  return {
    payload: `intervals://bean/${bean.id}`,
    caption: lines(
      bean.id ? [run(bean.id, { bold: true })] : undefined,
      bean.name ? [run(bean.name, { bold: true })] : undefined,
      hasRoastInfo ? [run('——')] : undefined,
      bean.roastLevel ? [run(bean.roastLevel)] : undefined,
      roastDate ? [run(roastDate)] : undefined,
      bean.roaster ? [run('——')] : undefined,
      bean.roaster ? [run(bean.roaster)] : undefined,
    ),
  }
}
