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
 * Formats the bean's raw ISO roast date (e.g. "2026-09-20") into uppercase
 * display, e.g. "20 SEP 2026".
 */
function formatRoastDate(isoDate?: string | null): string | undefined {
  if (!isoDate) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!match) return undefined
  const [, y, m, d] = match
  const month = MONTH_NAMES[parseInt(m, 10) - 1]
  return `${parseInt(d, 10)} ${month} ${y}`
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
  const roastDate = formatRoastDate(bean.roastDate)
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
