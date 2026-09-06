import { ArrowLeft, Coffee, Plus, Printer, Star, Timer } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { PrintLabelDialog } from '@/components/print'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Badge,
  Button,
  Card,
  Heading,
  Image,
  Input,
  Row,
  Skeleton,
  SkeletonLine,
  Spacer,
  Stack,
  Text,
} from '@/components/ui'
import type {
  BrewLogEntry,
  BrewLogInput,
  BrewResult,
  CoffeeBean,
} from '@/lib/contracts'
import { fetchCoffeeBean, logBrew } from '@/lib/data'
import { beanLabel } from '@/lib/labels'
import { useResource } from '@/lib/useResource'

const BREW_METHODS = ['Espresso', 'V60', 'AeroPress', 'French Press', 'Moka', 'Cold Brew'] as const
const BREW_RESULTS: BrewResult[] = ['Sour / Under', 'Balanced', 'Bitter / Over']

/**
 * Bean detail — reached from the catalog grid or by scanning the jar's QR
 * (`intervals://bean/<id>`). Shows the catalog facts, the current dialed-in
 * target, and the brew-log history, with a form to log the next shot.
 */
export function BeanView({ beanId }: { beanId: string }) {
  const { back, canGoBack } = useRouter()
  const bean = useResource(() => fetchCoffeeBean(beanId), [beanId])
  const [printing, setPrinting] = useState(false)

  return (
    <AsyncScreen
      resource={bean}
      loadingLabel="Fetching bean"
      errorLabel="That bean would not load"
      skeleton={<BeanSkeleton />}
    >
      {(data) => (
        <Stack gap="lg" className="h-full">
          <Row gap="md">
            {canGoBack ? (
              <Button variant="ghost" size="icon" aria-label="Back" onClick={back}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
            ) : null}
            <Stack gap="xs" className="min-w-0">
              <Heading role="hero" level={1} className="min-w-0">
                {data.name}
              </Heading>
              {data.roaster ? <Text tone="dim">{data.roaster}</Text> : null}
            </Stack>
            <Spacer />
            <Text tone="faint">{data.id}</Text>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Print label"
              onClick={() => setPrinting(true)}
            >
              <Printer className="h-6 w-6" />
            </Button>
          </Row>

          <PrintLabelDialog
            label={beanLabel(data)}
            open={printing}
            onClose={() => setPrinting(false)}
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-1">
                <BeanFacts bean={data} />
              </div>
              <div className="col-span-2">
                <BrewLog
                  bean={data}
                  onLogged={() => bean.reload()}
                />
              </div>
            </div>
          </div>
        </Stack>
      )}
    </AsyncScreen>
  )
}

function BeanFacts({ bean }: { bean: CoffeeBean }) {
  return (
    <Stack gap="md">
      {bean.imageUrl ? (
        <Image src={bean.imageUrl} alt="" ratio="wide" />
      ) : (
        <div className="flex aspect-[3/2] w-full items-center justify-center rounded-card bg-raised">
          <Coffee className="h-10 w-10 text-ink-faint" />
        </div>
      )}

      <Row gap="sm" className="flex-wrap">
        {bean.roastLevel ? <Badge tone="ember">{bean.roastLevel}</Badge> : null}
        {bean.process ? <Badge>{bean.process}</Badge> : null}
        {bean.status ? <Badge>{bean.status}</Badge> : null}
        {bean.rating ? (
          <Badge>
            <Star className="mr-1 h-3.5 w-3.5" />
            {bean.rating}
          </Badge>
        ) : null}
      </Row>

      {bean.targetRecipe ? (
        <Card pad="sm">
          <Stack gap="xs">
            <Text size="xs" tone="faint">
              Target recipe
            </Text>
            <Text tone="ember">{bean.targetRecipe}</Text>
          </Stack>
        </Card>
      ) : null}

      <Stack gap="xs">
        <Fact label="Origin" value={bean.origin} />
        <Fact label="Region" value={bean.region} />
        <Fact label="Producer" value={bean.producer} />
        <Fact label="Varietal" value={bean.varietal} />
        <Fact label="Altitude" value={bean.altitude} />
        <Fact label="Roasted" value={bean.roastDateLabel} />
        <Fact label="Bought" value={bean.purchaseDateLabel} />
        <Fact label="Weight" value={bean.weightG ? `${bean.weightG} g` : undefined} />
        <Fact label="Notes" value={bean.tastingNotes} />
      </Stack>
    </Stack>
  )
}

function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <Row gap="sm" align="start">
      <Text size="sm" tone="faint" className="w-20 shrink-0">
        {label}
      </Text>
      <Text size="sm" className="min-w-0">
        {value}
      </Text>
    </Row>
  )
}

function BrewLog({
  bean,
  onLogged,
}: {
  bean: CoffeeBean
  onLogged: () => void
}) {
  const [adding, setAdding] = useState(false)

  return (
    <Stack gap="md">
      <Row>
        <Heading role="section">Brew log</Heading>
        <Spacer />
        {!adding ? (
          <Button size="md" onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Log a shot
          </Button>
        ) : null}
      </Row>

      {adding ? (
        <LogBrewForm
          beanId={bean.id}
          methods={bean.brewMethods}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            onLogged()
          }}
        />
      ) : null}

      {bean.brews.length === 0 ? (
        <Text tone="faint">No brews logged yet. Dial one in.</Text>
      ) : (
        <Stack gap="sm">
          {bean.brews.map((brew) => (
            <BrewRow key={brew.id} brew={brew} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function BrewRow({ brew }: { brew: BrewLogEntry }) {
  return (
    <Card pad="sm">
      <Stack gap="xs">
        <Row gap="sm" className="flex-wrap">
          <Badge tone="ember">{brew.method}</Badge>
          {brew.result ? <Badge tone={resultTone(brew.result)}>{brew.result}</Badge> : null}
          <Spacer />
          <Text size="sm" tone="faint">
            {brew.dateLabel}
          </Text>
        </Row>

        <Row gap="md" className="flex-wrap">
          {brew.grind ? <Metric label="Grind" value={brew.grind} /> : null}
          {brew.doseG != null ? <Metric label="Dose" value={`${brew.doseG}g`} /> : null}
          {brew.yieldG != null ? <Metric label="Yield" value={`${brew.yieldG}g`} /> : null}
          {brew.ratio != null ? <Metric label="Ratio" value={`1:${brew.ratio}`} /> : null}
          {brew.timeS != null ? (
            <Metric label="Time" value={`${brew.timeS}s`} icon={<Timer className="h-3.5 w-3.5" />} />
          ) : null}
          {brew.waterTempC != null ? <Metric label="Temp" value={`${brew.waterTempC}°C`} /> : null}
          {brew.rating != null ? (
            <Metric label="Rating" value={`${brew.rating}`} icon={<Star className="h-3.5 w-3.5" />} />
          ) : null}
        </Row>

        {brew.adjustment ? (
          <Text size="sm" tone="dim">
            → {brew.adjustment}
          </Text>
        ) : null}
        {brew.notes ? (
          <Text size="sm" tone="faint">
            {brew.notes}
          </Text>
        ) : null}
      </Stack>
    </Card>
  )
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <Stack gap="xs">
      <Text size="xs" tone="faint">
        {label}
      </Text>
      <Row gap="xs" align="center">
        {icon}
        <Text size="sm">{value}</Text>
      </Row>
    </Stack>
  )
}

function resultTone(result: BrewResult): 'sage' | 'clay' | 'neutral' {
  if (result === 'Balanced') return 'sage'
  if (result === 'Bitter / Over') return 'clay'
  return 'neutral' // Sour / Under
}

/** The dial-in form. Numbers are optional — log as much or as little as the
 *  moment allows; the ratio is derived by the backend from dose and yield. */
function LogBrewForm({
  beanId,
  methods,
  onCancel,
  onDone,
}: {
  beanId: string
  methods: string[]
  onCancel: () => void
  onDone: () => void
}) {
  // Default the method to the bean's first configured brew method, else Espresso.
  const [method, setMethod] = useState<string>(methods[0] ?? 'Espresso')
  const [grind, setGrind] = useState('')
  const [dose, setDose] = useState('')
  const [yieldG, setYieldG] = useState('')
  const [time, setTime] = useState('')
  const [temp, setTemp] = useState('')
  const [result, setResult] = useState<BrewResult | ''>('')
  const [rating, setRating] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (v: string): number | undefined => {
    const n = Number(v)
    return v.trim() !== '' && Number.isFinite(n) ? n : undefined
  }

  async function submit() {
    setSaving(true)
    setError(null)
    const input: BrewLogInput = {
      beanId,
      method,
      grind: grind.trim() || undefined,
      doseG: num(dose),
      yieldG: num(yieldG),
      timeS: num(time),
      waterTempC: num(temp),
      result: result || undefined,
      rating: num(rating),
      adjustment: adjustment.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      await logBrew(input)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brew')
      setSaving(false)
    }
  }

  return (
    <Card pad="md">
      <Stack gap="md">
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

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Grind">
            <Input value={grind} onChange={(e) => setGrind(e.target.value)} placeholder="2.5" />
          </Field>
          <Field label="Dose (g)">
            <Input value={dose} onChange={(e) => setDose(e.target.value)} type="number" inputMode="decimal" placeholder="18" />
          </Field>
          <Field label="Yield (g)">
            <Input value={yieldG} onChange={(e) => setYieldG(e.target.value)} type="number" inputMode="decimal" placeholder="38" />
          </Field>
          <Field label="Time (s)">
            <Input value={time} onChange={(e) => setTime(e.target.value)} type="number" inputMode="numeric" placeholder="28" />
          </Field>
          <Field label="Temp (°C)">
            <Input value={temp} onChange={(e) => setTemp(e.target.value)} type="number" inputMode="numeric" placeholder="94" />
          </Field>
          <Field label="Rating">
            <Input value={rating} onChange={(e) => setRating(e.target.value)} type="number" inputMode="numeric" placeholder="1–5" />
          </Field>
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

        <Field label="Adjustment for next time">
          <Input
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="Grind finer, aim ~30s"
          />
        </Field>

        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else" />
        </Field>

        {error ? <Text tone="ember">{error}</Text> : null}

        <Row gap="sm">
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save brew'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </Card>
  )
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

function BeanSkeleton() {
  return (
    <Stack gap="lg" className="h-full">
      <Row gap="md">
        <Heading role="hero" level={1} className="w-64">
          <SkeletonLine />
        </Heading>
      </Row>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="col-span-1 aspect-[3/2] rounded-card" />
        <Stack gap="sm" className="col-span-2">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </Stack>
      </div>
    </Stack>
  )
}
