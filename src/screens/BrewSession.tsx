import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Button,
  Card,
  Heading,
  Input,
  Row,
  RulerSlider,
  Scrubber,
  Spacer,
  Stack,
  Text,
} from '@/components/ui'
import type { BrewLogInput, BrewResult, CoffeeBean } from '@/lib/contracts'
import { fetchCoffeeBean, logBrew } from '@/lib/data'
import { parseTarget } from '@/lib/coffee-utils'
import { useResource } from '@/lib/useResource'

const BREW_METHODS = ['Espresso', 'V60', 'AeroPress', 'French Press', 'Moka', 'Cold Brew'] as const
const BREW_RESULTS: BrewResult[] = ['Sour / Under', 'Balanced', 'Bitter / Over']

const TEMP_KEY = 'intervals:brew:lastTempC'

export function BrewSession({ beanId }: { beanId: string }) {
  const bean = useResource(() => fetchCoffeeBean(beanId), [beanId])

  return (
    <AsyncScreen
      resource={bean}
      loadingLabel="Fetching bean"
      errorLabel="That bean would not load"
    >
      {(data) => <Session bean={data} />}
    </AsyncScreen>
  )
}

function num(t: string | null | undefined): number | undefined {
  const m = (t ?? '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : undefined
}

function Session({ bean }: { bean: CoffeeBean }) {
  const { back } = useRouter()
  const target = parseTarget(bean.targetRecipe)

  const [method, setMethod] = useState<string>(bean.brewMethods?.[0] ?? 'Espresso')
  const [grind, setGrind] = useState(num(target?.grind) ?? 3)
  const [dose, setDose] = useState(num(target?.dose) ?? 18)
  const [yieldG, setYieldG] = useState(num(target?.yield) ?? 36)
  const [time, setTime] = useState(num(target?.time) ?? 30)

  const lastTemp = parseInt(localStorage.getItem(TEMP_KEY) ?? '93', 10)
  const [temp, setTemp] = useState(isNaN(lastTemp) ? 93 : lastTemp)

  const [result, setResult] = useState<BrewResult | ''>('')
  const [rating, setRating] = useState(0)
  const [adjustment, setAdjustment] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const espresso = method === 'Espresso'
  const ratio = dose > 0 ? Math.round((yieldG / dose) * 10) / 10 : null
  const inRange = ratio != null && ratio >= 1.5 && ratio <= 18

  const targetDose = num(target?.dose)
  const targetYield = num(target?.yield)
  const targetRatio =
    targetDose && targetDose > 0 && targetYield
      ? Math.round((targetYield / targetDose) * 10) / 10
      : null
  const drift =
    targetRatio != null && ratio != null
      ? Math.round((ratio - targetRatio) * 10) / 10
      : null

  async function submit() {
    setSaving(true)
    setError(null)
    localStorage.setItem(TEMP_KEY, String(temp))
    const input: BrewLogInput = {
      beanId: bean.id,
      method,
      grind: grind.toFixed(1),
      doseG: dose,
      yieldG,
      timeS: time,
      waterTempC: temp,
      result: result || undefined,
      rating: rating || undefined,
      adjustment: adjustment.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      await logBrew(input)
      back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brew')
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg" className="h-full min-h-0 overflow-hidden">
      {/* Header */}
      <Row gap="md">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={back}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Stack gap="none" className="min-w-0">
          <Heading role="title">Dial in</Heading>
          <Text size="sm" tone="dim">
            {bean.name} · {bean.roaster}
          </Text>
        </Stack>
        <Spacer />
        <Stack gap="none" align="end">
          <Text size="xs" tone="faint">
            Target {bean.targetRecipe}
          </Text>
          <Row gap="sm" align="baseline">
            <span
              className="text-[2.5rem] font-semibold leading-none tabular-nums"
              style={{ color: inRange ? 'var(--color-ember)' : 'var(--color-ink)' }}
            >
              {ratio != null ? `1:${ratio.toFixed(1)}` : '—'}
            </span>
            {drift != null && drift !== 0 ? (
              <Text
                size="sm"
                tone={Math.abs(drift) <= 0.2 ? 'faint' : 'default'}
                className="tabular-nums"
                style={{ color: Math.abs(drift) > 0.2 ? 'var(--color-clay)' : undefined }}
              >
                {drift > 0 ? '+' : ''}{drift.toFixed(1)} vs target
              </Text>
            ) : (
              <Text size="sm" tone="sage">
                on target
              </Text>
            )}
          </Row>
        </Stack>
      </Row>

      {/* Band 1 - Live Controls */}
      <Card pad="md">
        <Stack gap="md">
          <Row gap="sm" className="flex-wrap">
            {BREW_METHODS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={method === m ? 'select' : 'quiet'}
                onClick={() => setMethod(m)}
              >
                {m}
              </Button>
            ))}
          </Row>
          <RulerSlider
            label="Grind — drag like the collar"
            value={grind}
            onChange={setGrind}
            min={0}
            max={16}
            step={0.1}
            minorUntil={4}
          />
        </Stack>
      </Card>

      <div className="grid grid-cols-4 gap-3.5">
        <Card pad="md">
          <Scrubber
            label="Dose"
            value={dose}
            onChange={setDose}
            min={0}
            step={0.1}
            format={(v) => v.toFixed(1)}
            unit="g"
          />
        </Card>
        <Card pad="md">
          <Scrubber
            label="Yield"
            value={yieldG}
            onChange={setYieldG}
            min={0}
            step={espresso ? 0.5 : 5}
            format={(v) => v.toFixed(espresso ? 1 : 0)}
            unit="g"
          />
        </Card>
        <Card pad="md">
          <Scrubber
            label="Time"
            value={time}
            onChange={setTime}
            step={espresso ? 1 : 5}
            min={0}
            format={formatTime}
          />
        </Card>
        <Card pad="md">
          <Scrubber
            label="Temp"
            value={temp}
            onChange={setTemp}
            step={1}
            min={70}
            max={100}
            unit="°C"
          />
        </Card>
      </div>

      {/* Band 2 - Filled in after */}
      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-5 overflow-y-auto pr-2">
        <Stack gap="lg">
          <Field label="Result">
            <Row gap="sm" className="flex-wrap">
              {BREW_RESULTS.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={result === r ? 'select' : 'quiet'}
                  onClick={() => setResult(result === r ? '' : r)}
                >
                  {r}
                </Button>
              ))}
            </Row>
          </Field>
          <Field label="Rating" hint="out of five">
            <Row gap="sm">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={rating >= n && rating > 0 ? 'select' : 'quiet'}
                  onClick={() => setRating(rating === n ? 0 : n)}
                  className="min-w-10 px-0"
                >
                  {n}
                </Button>
              ))}
            </Row>
          </Field>
        </Stack>

        <Stack gap="lg">
          <Field label="Adjustment for next time">
            <Input
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="Grind finer, aim ~30s"
            />
          </Field>
          <Field label="Notes">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else"
            />
          </Field>
        </Stack>
      </div>

      {error ? <Text tone="ember">{error}</Text> : null}

      {/* Footer */}
      <Row gap="sm" className="shrink-0 border-t border-line pt-3">
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save brew'}
        </Button>
        <Button variant="ghost" onClick={back} disabled={saving}>
          Cancel
        </Button>
        <Spacer />
        <Text size="xs" tone="faint">
          {method} · {grind.toFixed(1)} · {dose.toFixed(1)}g in · {yieldG}g out · {formatTime(time)} · {temp}°C
        </Text>
      </Row>
    </Stack>
  )
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <Stack gap="xs">
      <Row gap="sm" align="baseline">
        <Heading role="label" as="span" tone="faint">
          {label}
        </Heading>
        {hint ? <Text size="xs" tone="faint">{hint}</Text> : null}
      </Row>
      {children}
    </Stack>
  )
}
