import { ArrowLeft, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { AsyncScreen } from '@/components/ScreenState'
import { Badge, Button, Card, Input, Row, Spacer, Stack, Text } from '@/components/ui'
import type { FinanceAccount, FinanceStatement } from '@/lib/contracts'
import {
  confirmFinanceStatement,
  fetchFinanceAccounts,
  fetchFinanceStatement,
  fetchFinanceStatements,
  retryFinanceStatement,
  uploadFinanceStatement,
} from '@/lib/data'
import { dayLabel, formatMoney, statementErrorLabel } from '@/lib/finance-utils'
import { useResource } from '@/lib/useResource'

/**
 * Bank statements: upload a PDF, wait while the server reads it, check what it found, and confirm.
 * A statement that has not been confirmed does not count anywhere.
 */
export function StatementsTab() {
  const [openId, setOpenId] = useState<number | null>(null)
  const statements = useResource(() => fetchFinanceStatements(), [openId])

  if (openId !== null) return <StatementDetail id={openId} onBack={() => setOpenId(null)} />

  return (
    <div className="h-full overflow-y-auto pr-1">
      <Stack gap="lg">
        <UploadForm onUploaded={(statement) => setOpenId(statement.id)} />
        <AsyncScreen resource={statements} loadingLabel="Loading statements" errorLabel="The statements would not load" skeleton={<Card pad="md" className="h-24" />}>
          {(list) =>
            list.length === 0 ? (
              <Text tone="faint">No statements yet.</Text>
            ) : (
              <Stack gap="sm">
                {list.map((statement) => (
                  <Card key={statement.id} as="button" interactive pad="md" className="text-left" onClick={() => setOpenId(statement.id)}>
                    <Row gap="md">
                      <Stack gap="xs" className="min-w-0 flex-1">
                        <Text>{statement.accountName}</Text>
                        <Text size="sm" tone="faint">
                          {statement.periodStart && statement.periodEnd
                            ? `${dayLabel(statement.periodStart)} to ${dayLabel(statement.periodEnd)}`
                            : (statement.fileName ?? 'Statement')}
                          {statement.transactionCount ? ` · ${statement.transactionCount} lines` : ''}
                        </Text>
                      </Stack>
                      <StatusBadge statement={statement} />
                    </Row>
                  </Card>
                ))}
              </Stack>
            )
          }
        </AsyncScreen>
      </Stack>
    </div>
  )
}

function StatusBadge({ statement }: { statement: FinanceStatement }) {
  switch (statement.status) {
    case 'review':
      return <Badge tone="ember">needs review</Badge>
    case 'confirmed':
      return <Badge tone="sage">confirmed</Badge>
    case 'failed':
      return <Badge tone="clay">failed</Badge>
    default:
      return <Badge>reading…</Badge>
  }
}

/** The account to file the PDF under, the PDF, and its password if it has one. */
function UploadForm({ onUploaded }: { onUploaded: (statement: FinanceStatement) => void }) {
  const accounts = useResource(() => fetchFinanceAccounts(), [])
  return (
    <Card pad="lg">
      <AsyncScreen resource={accounts} loadingLabel="Loading accounts" errorLabel="The accounts would not load" skeleton={<div className="h-24" />}>
        {(list) => <UploadFields accounts={list} onUploaded={onUploaded} />}
      </AsyncScreen>
    </Card>
  )
}

function UploadFields({ accounts, onUploaded }: { accounts: FinanceAccount[]; onUploaded: (statement: FinanceStatement) => void }) {
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (accountId === null || !file) return
    setBusy(true)
    setError(null)
    try {
      onUploaded(await uploadFinanceStatement(accountId, file, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload failed.')
      setBusy(false)
    }
  }

  return (
    <Stack gap="md">
      <Text size="sm" tone="faint">
        Upload a statement PDF. If it has a password, enter it: the server uses it once and does not keep it.
      </Text>
      <Row gap="md" className="flex-wrap">
        <select
          aria-label="Account"
          value={accountId ?? ''}
          onChange={(event) => setAccountId(Number(event.target.value))}
          className="min-h-touch rounded-control border border-line bg-surface px-4 text-ink focus:border-ember focus:outline-none"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <input ref={picker} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <Button variant="secondary" onClick={() => picker.current?.click()}>
          <Upload className="h-5 w-5" />
          {file ? file.name : 'Choose a PDF'}
        </Button>
        <Input type="password" autoComplete="off" placeholder="PDF password (if any)" value={password} onChange={(event) => setPassword(event.target.value)} className="max-w-64" />
        <Button variant="primary" disabled={busy || !file || accountId === null} onClick={submit}>
          {busy ? 'Uploading…' : 'Read statement'}
        </Button>
      </Row>
      {error ? (
        <Text size="sm" className="text-clay" role="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  )
}

/** One statement. While the server reads it, this polls; when it is ready, the lines can be checked and confirmed. */
function StatementDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [statement, setStatement] = useState<FinanceStatement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const next = await fetchFinanceStatement(id)
        if (cancelled) return
        setStatement(next)
        if (next.status === 'uploaded' || next.status === 'extracting') timer = setTimeout(load, 2000)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'The statement would not load.')
      }
    }
    void load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [id, round])

  const act = async (run: () => Promise<FinanceStatement>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await run()
      setStatement(next)
      if (next.status === 'uploaded' || next.status === 'extracting') setRound((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-1">
      <Stack gap="lg">
        <Row gap="md">
          <Button size="icon" variant="ghost" aria-label="Back to statements" onClick={onBack}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <Text className="font-display text-[1.25rem]">{statement?.accountName ?? 'Statement'}</Text>
          {statement ? <StatusBadge statement={statement} /> : null}
          <Spacer />
          {statement?.status === 'review' ? (
            <Button variant="primary" disabled={busy} onClick={() => act(() => confirmFinanceStatement(id))}>
              Confirm
            </Button>
          ) : null}
          {statement?.status === 'failed' ? (
            <Button variant="secondary" disabled={busy} onClick={() => act(() => retryFinanceStatement(id))}>
              Read again
            </Button>
          ) : null}
        </Row>

        {error ? (
          <Text size="sm" className="text-clay" role="alert">
            {error}
          </Text>
        ) : null}

        {statement && (statement.status === 'uploaded' || statement.status === 'extracting') ? (
          <Text tone="dim" role="status">
            The server is reading the statement. This takes a moment.
          </Text>
        ) : null}

        {statement?.status === 'failed' ? <Text className="text-clay">{statementErrorLabel(statement.error)}</Text> : null}

        {statement && (statement.status === 'review' || statement.status === 'confirmed') ? <StatementLines statement={statement} /> : null}
      </Stack>
    </div>
  )
}

function StatementLines({ statement }: { statement: FinanceStatement }) {
  const lines = statement.transactions ?? []
  const money = (cents: number) => formatMoney(cents, statement.currency)

  return (
    <Stack gap="md">
      <Row gap="md" className="flex-wrap">
        {statement.periodStart && statement.periodEnd ? (
          <Badge>
            {dayLabel(statement.periodStart)} to {dayLabel(statement.periodEnd)}
          </Badge>
        ) : null}
        {statement.openingBalanceCents !== undefined ? <Badge>opening {money(statement.openingBalanceCents)}</Badge> : null}
        {statement.closingBalanceCents !== undefined ? <Badge>closing {money(statement.closingBalanceCents)}</Badge> : null}
        {statement.reconciled === true ? <Badge tone="sage">balances agree</Badge> : null}
        {statement.reconciled === false ? (
          <Badge tone="clay">
            balances differ by {money(Math.abs(statement.reconcileDifferenceCents ?? 0))}: check the lines
          </Badge>
        ) : null}
        {statement.skippedDuplicates > 0 ? <Badge>{statement.skippedDuplicates} lines already known</Badge> : null}
      </Row>

      {statement.notes ? (
        <Text size="sm" tone="dim">
          {statement.notes}
        </Text>
      ) : null}

      {statement.status === 'review' ? (
        <Text size="sm" tone="faint">
          These lines do not count in the forecast until you confirm. Confirming also saves the closing balance.
        </Text>
      ) : null}

      <Card pad="md">
        <Stack gap="xs">
          {lines.map((line) => (
            <Row key={line.id} gap="md" className="border-b border-line py-2 last:border-0">
              <Text className="w-16 shrink-0" tone="dim">
                {dayLabel(line.postedOn)}
              </Text>
              <Stack gap="xs" className="min-w-0 flex-1">
                <Text>{line.merchant ?? line.description}</Text>
                {line.merchant ? (
                  <Text size="sm" tone="faint" className="truncate">
                    {line.description}
                  </Text>
                ) : null}
              </Stack>
              {line.category ? <Badge>{line.category}</Badge> : null}
              <Text className={`w-28 shrink-0 text-right tabular-nums ${line.amountCents > 0 ? 'text-sage' : ''}`}>{money(line.amountCents)}</Text>
            </Row>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}
