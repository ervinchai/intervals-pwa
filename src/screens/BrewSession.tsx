import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useRouter, type ShotResult } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import { StepRail } from '@/components/shot/StepRail'
import {
  Button,
  Card,
  Heading,
  Input,
  Row,
  RulerSlider,
  Scrubber,
  Skeleton,
  SkeletonLine,
  Spacer,
  Stack,
  Text,
} from '@/components/ui'
import type { BrewLogInput, BrewResult, CoffeeBean } from '@/lib/contracts'
import { fetchCoffeeBean, logBrew } from '@/lib/data'
import {
  CUP_AXES,
  brewKind,
  defaultBrewMethod,
  formatBrewTime,
  formatShotClock as formatTime,
  lastBrewTemp,
  parseTarget,
  saveBrewTemp,
} from '@/lib/coffee-utils'
import { useResource } from '@/lib/useResource'

const BREW_METHODS = ['Espresso', 'V60', 'AeroPress', 'French Press', 'Moka', 'Cold Brew'] as const
const BREW_RESULTS: BrewResult[] = ['Sour / Under', 'Balanced', 'Bitter / Over']

export function BrewSession({ beanId, shot }: { beanId: string; shot?: ShotResult }) {
  const bean = useResource(() => fetchCoffeeBean(beanId), [beanId])

  return (
    <AsyncScreen
      resource={bean}
      loadingLabel="Fetching bean"
      errorLabel="That bean would not load"
      skeleton={<BrewSessionSkeleton />}
    >
      {(data) => <Session bean={data} shot={shot} />}
    </AsyncScreen>
  )
}

/** How the pull's yield was got, for the rail: nothing for a scale reading, else typed in or corrected. */
function pullNote(shot: ShotResult): string {
  if (shot.scaleG !== undefined) return shot.yieldG === shot.scaleG ? '' : ' · edited'
  return shot.manual ? ' · by hand' : ''
}

function num(t: string | null | undefined): number | undefined {
  const m = (t ?? '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : undefined
}

/** The target value for one field, pinned in the corner of its own control
 *  instead of listed once as a block up top disconnected from the controls
 *  it describes. Hidden when there's no target for that field. */
function TargetHint({ value }: { value?: string }) {
  if (!value) return null
  return (
    <Text size="sm" tone="faint" className="absolute right-3 top-3">
      target {value}
    </Text>
  )
}

function Session({ bean, shot }: { bean: CoffeeBean; shot?: ShotResult }) {
  const { back, canGoBack, replace } = useRouter()
  // A brew screen is always reached from its bean, but can also load fresh —
  // a QR scan, a shared link, an HA push — with no history behind it. Fall
  // back to the bean detail rather than letting back() no-op in that case. The bean takes this screen's
  // place: pushing it on top would make back go round in a circle.
  const goBack = () => (canGoBack ? back() : replace({ name: 'bean', beanId: bean.id }))
  const target = parseTarget(bean.targetRecipe)

  // From the espresso flow it is an espresso, with the grind, dose, yield and temperature of the shot. The
  // time is the pump's run time or the number typed in; without either it starts from the bean's target.
  const [method, setMethod] = useState<string>(shot ? 'Espresso' : defaultBrewMethod(brewKind(bean.brewMethods)))
  const [grind, setGrind] = useState(shot?.grind ?? num(target?.grind) ?? 3)
  const [dose, setDose] = useState(shot?.doseG ?? num(target?.dose) ?? 18)
  const [yieldG, setYieldG] = useState(shot?.yieldG ?? num(target?.yield) ?? 36)
  const [time, setTime] = useState(shot?.timeS ?? num(target?.time) ?? 30)

  const [temp, setTemp] = useState(() => shot?.tempC ?? lastBrewTemp())

  // From the espresso flow the numbers are settled already (on the pull step, by the scale or by hand), so it
  // opens on rating the shot. Its Back returns to the pull. The numbers form is only for a log made here.
  const [step, setStep] = useState<1 | 2>(shot ? 2 : 1)

  const [result, setResult] = useState<BrewResult | ''>('')
  const [cup, setCup] = useState<Partial<Record<(typeof CUP_AXES)[number]['key'], number>>>({})
  const [adjustment, setAdjustment] = useState('')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const espresso = method === 'Espresso'
  const ratio = dose > 0 ? Math.round((yieldG / dose) * 10) / 10 : null
  const inRange = ratio != null && ratio >= 1.5 && ratio <= 18

  const targetDose = num(target?.dose)
  const targetYield = num(target?.yield)
  const targetTimeS = num(target?.time)
  const targetRatio =
    targetDose && targetDose > 0 && targetYield
      ? Math.round((targetYield / targetDose) * 10) / 10
      : null
  const drift =
    targetRatio != null && ratio != null
      ? Math.round((ratio - targetRatio) * 10) / 10
      : null

  async function submit(after: 'bean' | 'another' = 'bean') {
    setSaving(true)
    setError(null)
    saveBrewTemp(temp)
    const input: BrewLogInput = {
      beanId: bean.id,
      method,
      grind: grind.toFixed(1),
      doseG: dose,
      yieldG,
      timeS: time,
      waterTempC: temp,
      result: result || undefined,
      body: cup.body,
      sweetness: cup.sweetness,
      acidity: cup.acidity,
      aftertaste: cup.aftertaste,
      adjustment: adjustment.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      await logBrew(input)
      // "Another" goes straight to the next espresso, in place of this screen, so back still reaches the bean.
      if (after === 'another') replace({ name: 'espresso', beanId: bean.id })
      else goBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brew')
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg" className="h-full min-h-0 overflow-hidden">
      {/* Header — a back breadcrumb to the bean it was opened from, same
          pattern as the bean detail screen's breadcrumb to the catalog. */}
      <Stack gap="xs">
        <Button variant="ghost" size="sm" className="w-fit -ml-3 px-3" onClick={goBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {bean.name}
        </Button>
        <Row gap="md">
          <Stack gap="none" className="min-w-0">
            <Heading role="title">{step === 1 ? 'Add brew log' : 'How was it?'}</Heading>
            <Text size="sm" tone="dim">
              {step === 1
                ? `${bean.roaster} · ${bean.id} · ${bean.status}`
                : 'Optional — skip if you’re in a hurry'}
            </Text>

          </Stack>
          <Spacer />
          {step === 1 ? (
            // The live ratio readout — it's the one number you're actively
            // tuning here, so it earns the full-size treatment. Dropped on
            // step 2: the recipe's already locked in, restating it that loud
            // would just compete with Result / Cup profile for attention.
            <Stack gap="none" align="end">
              <Row gap="sm" align="baseline">
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
                <span
                  className="text-[2.5rem] font-semibold leading-none tabular-nums"
                  style={{ color: inRange ? 'var(--color-ember)' : 'var(--color-ink)' }}
                >
                  {ratio != null ? `1:${ratio.toFixed(1)}` : '—'}
                </span>
              </Row>
            </Stack>
          ) : (
            <Text size="sm" tone="faint" className="tabular-nums text-right">
              {method} · {dose.toFixed(1)}g → {yieldG}g · {formatTime(time)} · {temp}°C
            </Text>
          )}
        </Row>
      </Stack>

      {shot ? (
        <StepRail
          current={2}
          steps={[
            { label: 'Grind & dose', summary: `${shot.grind.toFixed(1)} · ${shot.doseG.toFixed(1)} g` },
            { label: 'Pull', summary: `${shot.yieldG.toFixed(1)} g${pullNote(shot)}` },
            { label: 'Rate' },
          ]}
        />
      ) : null}

      {step === 1 ? (
        <>
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
              <div className="relative">
                <TargetHint value={target?.grind} />
                <RulerSlider
                  label="Grind"
                  value={grind}
                  onChange={setGrind}
                  min={0}
                  max={16}
                  step={0.1}
                  minorUntil={4}
                />
              </div>
            </Stack>
          </Card>

          <div className="grid grid-cols-2 gap-3.5">
            <Card pad="md" className="relative">
              <TargetHint value={targetDose != null ? `${targetDose}g` : undefined} />
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
            <Card pad="md" className="relative">
              <TargetHint value={targetYield != null ? `${targetYield}g` : undefined} />
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
                label="Temp"
                value={temp}
                onChange={setTemp}
                step={1}
                min={70}
                max={100}
                unit="°C"
              />
            </Card>
            <Card pad="md" className="relative">
              <TargetHint value={targetTimeS != null ? formatBrewTime(targetTimeS) : undefined} />
              <Scrubber
                label="Time"
                value={time}
                onChange={setTime}
                step={espresso ? 1 : 5}
                min={0}
                format={formatTime}
              />
            </Card>
          </div>

          <Spacer />

          {/* Footer */}
          <Row gap="sm" className="shrink-0 border-t border-line pt-3">
            <Spacer />
            <Button variant="ghost" onClick={goBack}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setStep(2)}>
              Continue
            </Button>
          </Row>
        </>
      ) : (
        <>
          {/* Band 2 - Evaluation, optional */}
          <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-5 overflow-y-auto pr-2">
            <Stack gap="3xl">
              <Field label="Result">
                <Row gap="sm" className="flex-wrap mt-1">
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

              <Field label="Cup profile">
                <Stack gap="xs">
                  {CUP_AXES.map((axis) => (
                    <ScaleField
                      key={axis.key}
                      label={axis.label}
                      low={axis.low}
                      high={axis.high}
                      value={cup[axis.key]}
                      onChange={(v) => setCup((c) => ({ ...c, [axis.key]: v }))}
                    />
                  ))}
                </Stack>
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
            <Button
              variant="ghost"
              // From the espresso flow, back is the pull step, reopened with the shot's numbers kept.
              onClick={() => (shot ? replace({ name: 'espresso', beanId: bean.id, shot }) : setStep(1))}
              disabled={saving}
            >
              {shot ? 'Back to pull' : 'Back'}
            </Button>
            <Spacer />
            <Button variant="quiet" onClick={() => submit()} disabled={saving}>
              Skip
            </Button>
            {shot ? (
              <Button variant="secondary" onClick={() => submit('another')} disabled={saving}>
                Save and make another
              </Button>
            ) : null}
            <Button variant="primary" onClick={() => submit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save brew'}
            </Button>
          </Row>
        </>
      )}
    </Stack>
  )
}

/**
 * Same shape as the loaded step-1 view — back breadcrumb, heading row, method
 * pills, grind slider, the 2x2 stat grid, footer buttons — so arrival is a
 * shimmer-to-content swap. The real fetch is fast, so without this the
 * generic centered-flame placeholder swaps for the whole header (including
 * the back button, which the placeholder didn't have at all) a beat after
 * the screen-level fade already starts, reading as a layout jump rather than
 * one clean fade-in.
 */
function BrewSessionSkeleton() {
  return (
    <Stack gap="lg" className="h-full min-h-0 overflow-hidden">
      <Stack gap="xs">
        <Row gap="sm" align="center" className="w-fit -ml-3 px-3 py-1.5 opacity-40">
          <ArrowLeft className="h-3.5 w-3.5" />
          <SkeletonLine className="w-24" />
        </Row>
        <Row gap="md">
          <Stack gap="xs" className="min-w-0">
            <SkeletonLine className="h-6 w-40" />
            <SkeletonLine className="w-56" />
          </Stack>
          <Spacer />
          <Skeleton className="h-10 w-24" />
        </Row>
      </Stack>

      <Card pad="md">
        <Stack gap="md">
          <Row gap="sm" className="flex-wrap">
            {BREW_METHODS.map((m) => (
              <Skeleton key={m} className="h-8 w-20" />
            ))}
          </Row>
          <Skeleton className="h-16" />
        </Stack>
      </Card>

      <div className="grid grid-cols-2 gap-3.5">
        {['dose', 'yield', 'temp', 'time'].map((k) => (
          <Card key={k} pad="md">
            <Skeleton className="h-20" />
          </Card>
        ))}
      </div>

      <Spacer />

      <Row gap="sm" className="shrink-0 border-t border-line pt-3">
        <Spacer />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </Row>
    </Stack>
  )
}

/**
 * One cup-profile axis: five equal-weight positions between two named
 * endpoints, no midpoint pre-selected. Deliberately dots, not a filled bar or
 * a number readout — it's a position on a named continuum, not a score, so
 * nothing here should read as "more is better." Tapping the current value
 * clears it back to unset. */
function ScaleField({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string
  low: string
  high: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <Row gap="md" align="center">
      <Text size="sm" tone="faint" className="w-24 shrink-0">
        {label}
      </Text>
      <Row gap="sm" align="center" className="flex-1">
        <Text size="sm" tone="faint" className="w-16 shrink-0 text-right">
          {low}
        </Text>
        <Row gap="sm" align="center" className="flex-1 justify-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${label} ${n} of 5`}
              aria-pressed={value === n}
              onClick={() => onChange(value === n ? undefined : n)}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border transition-colors duration-100"
                style={{
                  backgroundColor: value != null && n <= value ? 'var(--color-ink)' : 'transparent',
                  borderColor: value != null && n <= value ? 'var(--color-ink)' : 'var(--color-line)',
                }}
              />
            </button>
          ))}
        </Row>
        <Text size="sm" tone="faint" className="w-16 shrink-0">
          {high}
        </Text>
      </Row>
    </Row>
  )
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
        {hint ? <Text size="sm" tone="faint">{hint}</Text> : null}
      </Row>
      {children}
    </Stack>
  )
}
