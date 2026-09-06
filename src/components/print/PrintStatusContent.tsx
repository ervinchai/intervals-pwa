import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { Text } from '@/components/ui'

import type { PrintState } from './usePrintFlow'

/** Icon + copy for each non-idle print state. */
const STATUS = {
  connecting: {
    icon: <Loader2 className="h-12 w-12 animate-spin text-ember" />,
    title: 'Connecting to printer…',
    detail: null,
  },
  printing: {
    icon: <Loader2 className="h-12 w-12 animate-spin text-ember" />,
    title: 'Printing…',
    detail: null,
  },
  sent: {
    icon: <CheckCircle2 className="h-12 w-12 text-ember" />,
    title: 'Printed',
    detail: null,
  },
  error: {
    icon: <XCircle className="h-12 w-12 text-clay" />,
    title: 'Couldn’t print the label.',
    detail:
      'Check the printer’s connection and power, and make sure a label roll is loaded, then try again.',
  },
} as const

/**
 * The visual guts of a print status — icon, title, and optional detail —
 * without any backdrop or layout. Shared by the standalone status popup and the
 * confirm dialog so both render identical success / error copy.
 */
export function PrintStatusContent({
  state,
}: {
  state: Exclude<PrintState, 'idle'>
}) {
  const { icon, title, detail } = STATUS[state]
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {icon}
      <Text>{title}</Text>
      {detail && <Text tone="faint">{detail}</Text>}
    </div>
  )
}
