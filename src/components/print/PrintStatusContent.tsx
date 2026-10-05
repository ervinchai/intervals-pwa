import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { Text } from '@/components/ui'

import type { PrintReason } from '@/lib/contracts'

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

/** What to tell the user for each failure reason. */
const ERROR_DETAIL: Record<PrintReason, string> = {
  printer_asleep: 'The printer is asleep. Wake it by pressing its button, then try again.',
  printer_unreachable:
    'The printer is nearby but won’t connect. Turn it off and on, then try again.',
  printer_error:
    'Check the printer’s power, and make sure a label roll is loaded, then try again.',
  connection_lost: 'The connection dropped before the print finished. Try again.',
  service_unavailable: 'The print service isn’t reachable right now. Try again in a moment.',
}

/**
 * The visual guts of a print status — icon, title, and optional detail —
 * without any backdrop or layout. Shared by the standalone status popup and the
 * confirm dialog so both render identical success / error copy.
 */
export function PrintStatusContent({
  state,
  reason,
}: {
  state: Exclude<PrintState, 'idle'>
  reason?: PrintReason | null
}) {
  const { icon, title, detail: defaultDetail } = STATUS[state]
  const detail = state === 'error' && reason ? ERROR_DETAIL[reason] : defaultDetail
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {icon}
      <Text>{title}</Text>
      {detail && <Text tone="faint">{detail}</Text>}
    </div>
  )
}
