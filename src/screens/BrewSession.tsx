import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Button,
  Card,
  Heading,
  Input,
  RulerSlider,
  Row,
  Spacer,
  Stack,
  Scrubber,
  Text,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import type { BrewLogInput, BrewResult, CoffeeBean } from '@/lib/contracts'
import { fetchCoffeeBean, logBrew } from '@/lib/data'
import { useResource } from '@/lib/useResource'

const BREW_METHODS = ['Espresso', 'V60', 'AeroPress', 'French Press', 'Moka', 'Cold Brew'] as const
const BREW_RESULTS: BrewResult[] = ['Sour / Under', 'Balanced', 'Bitter / Over']

// Water temp carries over between shots — the machine's set point rarely moves,
// so the last value you dialled is the right default next time.
const TEMP_KEY = 'intervals:brew:lastTempC'

/**
 * A live dial-in session on its own screen. Reached from the bean's `+`. The
 * point is to brew *with* it open — turn the grind collar, scrub dose, yield,
 * time and temp — and have the ratio and everything else move in real time,
 * then save the shot you actually pulled.
 */
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

/** Pulls the first number out of a target-recipe token like " 18g in ". */
function firstNumber(token: string | undefined): number | undefined {
  const m = token?.match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : undefined
}

function readLastTemp(): number {
  const stored = Number(localStorage.getItem(TEMP_KEY))
  return Number.isFinite(stored) && stored > 0 ? stored : 93
}

function Session({ bean }: { bean: CoffeeBean }) {
  const { back } = useRouter()

  // Seed the controls from the bean's dialed-in target
  // ("2.5 · 18g in · 38g out · 28s"), falling back to sane espresso numbers.
  const target = (bean.targetRecipe ?? '').split('·').map((s) => s.trim())
  const [method, setMethod] = useState<string>(bean.brewMethods[0] ?? 'Espresso')
  const [grind, setGrind] = useState(firstNumber(target[0]) ?? 3)
  const [dose, setDose] = useState(firstNumber(target[1]) ?? 18)
  const [yieldG, setYieldG] = useState(firstNumber(target[2]) ?? 36)
  const [time, setTime] = useState(firstNumber(target[3]) ?? 30)
  const [temp, setTemp] = useState(readLastTemp)
  const [result, setResult] = useState<BrewResult | ''>('')
  const [rating, setRating] = useState(0)
  const [adjustment, setAdjustment] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ratio = dose > 0 ? Math.round((yieldG / dose) * 10) / 10 : null

  // Espresso is dialled in grams and single seconds; a pour-over like the V60
  // runs long and gets nudged coarser, so key the scrub steps off the method.
  const espresso = method === 'Espresso'
  const yieldStep = espresso ? 0.5 : 5
  const timeStep = espresso ? 1 : 5

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
    <Stack gap="lg" className="h-full">
      <Row gap="md">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={back}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <Stack gap="xs" className="min-w-0">
          <Heading role="title" className="min-w-0">
            Dial in
          </Heading>
          <Text tone="dim">{bean.name}</Text>
        </Stack>
        <Spacer />
        {bean.targetRecipe ? (
          <Stack gap="xs" align="end" className="hidden sm:flex">
            <Text size="xs" tone="faint">
              Target
            </Text>
            <Text tone="ember">{bean.targetRecipe}</Text>
          </Stack>
        ) : null}
      </Row>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Stack gap="lg">
          <Field label="Method">
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
          </Field>

          {/* Grind collar — a ruler you drag like the grinder's markings */}
          <Card pad="lg">
            <RulerSlider
              label="Grind"
              value={grind}
              onChange={setGrind}
              min={0}
              max={16}
              step={0.1}
              minorUntil={4}
            />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
            {/* Dose · yield · ratio */}
            <Card pad="lg">
              <Stack gap="lg" className="h-full">
                <Scrubber
                  label="Dose"
                  value={dose}
                  onChange={setDose}
                  min={0}
                  step={0.1}
                  format={(v) => v.toFixed(1)}
                  unit="g"
                />
                <Scrubber
                  label="Yield"
                  value={yieldG}
                  onChange={setYieldG}
                  min={0}
                  step={yieldStep}
                  format={(v) => v.toFixed(espresso ? 1 : 0)}
                  unit="g"
                />
                <Spacer />
                <Row
                  align="baseline"
                  justify="between"
                  className="border-t border-line pt-4"
                >
                  <Text size="sm" tone="faint">
                    Ratio
                  </Text>
                  <span
                    className={cn(
                      'text-3xl font-semibold tabular-nums',
                      ratioInRange(ratio) ? 'text-ember' : 'text-ink',
                    )}
                  >
                    {ratio != null ? `1:${ratio.toFixed(1)}` : '—'}
                  </span>
                </Row>
              </Stack>
            </Card>

            {/* Time and temp — their own cards, stacked to match the dose/yield
                column height. Temp carries over between sessions. */}
            <div className="flex flex-col gap-6">
              <Card pad="lg" className="flex flex-1 flex-col justify-center">
                <Scrubber
                  label="Time"
                  value={time}
                  onChange={setTime}
                  step={timeStep}
                  min={0}
                  format={formatTime}
                />
              </Card>
              <Card pad="lg" className="flex flex-1 flex-col justify-center">
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
          </div>

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

          <Field label="Rating">
            <Row gap="sm" className="flex-wrap">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={rating === n ? 'select' : 'quiet'}
                  onClick={() => setRating(rating === n ? 0 : n)}
                >
                  {n}
                </Button>
              ))}
            </Row>
          </Field>

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

          {error ? <Text tone="ember">{error}</Text> : null}
        </Stack>
      </div>

      <Row gap="sm">
        <Button variant="primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save brew'}
        </Button>
        <Button variant="ghost" onClick={back} disabled={saving}>
          Cancel
        </Button>
      </Row>
    </Stack>
  )
}

/** Espresso lands roughly 1:1.5–1:3; a pour-over runs much longer (up to ~1:17),
 *  so treat anything from 1.5 up as "in a sensible brewing window" and accent it
 *  so a live pour reads at a glance. */
function ratioInRange(ratio: number | null): boolean {
  return ratio != null && ratio >= 1.5 && ratio <= 18
}

/** Seconds as m:ss once we're past a minute (pour-overs run long), plain "Ns"
 *  below that (an espresso shot). */
function formatTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap="xs">
      <Text size="sm" tone="faint">
        {label}
      </Text>
      {children}
    </Stack>
  )
}
