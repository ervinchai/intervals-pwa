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
 * caption of the name (bold), roaster/origin, and roast date. Accepts the
 * summary or the full detail — only the shared fields are used.
 */
export function beanLabel(bean: CoffeeBean | CoffeeBeanSummary): LabelInput {
  const originLine = [bean.roaster, bean.origin].filter(Boolean).join(' · ')
  return {
    payload: `intervals://bean/${bean.id}`,
    caption: lines(
      [run(bean.name, { bold: true })],
      originLine ? [run(originLine)] : undefined,
      bean.roastLevel ? [run(bean.roastLevel)] : undefined,
      bean.roastDateLabel ? [run(bean.roastDateLabel, { italic: true })] : undefined,
    ),
  }
}
