import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import {
  Button,
  Heading,
  Input,
  Row,
  Stack,
  Text,
} from '@/components/ui'
import type { BeanCreateInput } from '@/lib/contracts'
import { createBean } from '@/lib/data'

const PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic', 'Other'] as const
const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'] as const
const BREW_METHODS = ['Espresso', 'V60', 'AeroPress', 'French Press', 'Moka', 'Cold Brew'] as const
const STATUSES = ['Sealed', 'Open', 'Finished'] as const

/**
 * The "New bean" form — catalog a bag. Notion assigns the Bean ID and formats
 * the date labels, so the form sends only what you type. On save it opens the
 * new bean's detail screen, where its QR label can be printed.
 *
 * No photo: bags are identified by their printed QR, not a picture.
 */
export function NewBean() {
  const { back, navigate } = useRouter()

  const [name, setName] = useState('')
  const [roaster, setRoaster] = useState('')
  const [origin, setOrigin] = useState('')
  const [region, setRegion] = useState('')
  const [producer, setProducer] = useState('')
  const [varietal, setVarietal] = useState('')
  const [altitude, setAltitude] = useState('')
  const [process, setProcess] = useState('')
  const [roastLevel, setRoastLevel] = useState('')
  const [roastDate, setRoastDate] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [weightG, setWeightG] = useState('')
  const [price, setPrice] = useState('')
  const [brewMethods, setBrewMethods] = useState<string[]>([])
  const [targetRecipe, setTargetRecipe] = useState('')
  const [tastingNotes, setTastingNotes] = useState('')
  const [status, setStatus] = useState('')
  const [rating, setRating] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleMethod = (m: string) =>
    setBrewMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  const canSave = name.trim().length > 0 && !saving

  async function submit() {
    setSaving(true)
    setError(null)
    const input: BeanCreateInput = {
      name: name.trim(),
      roaster: roaster.trim() || undefined,
      origin: origin.trim() || undefined,
      region: region.trim() || undefined,
      producer: producer.trim() || undefined,
      process: process || undefined,
      varietal: varietal.trim() || undefined,
      altitude: altitude.trim() || undefined,
      roastLevel: roastLevel || undefined,
      roastDate: roastDate || undefined,
      purchaseDate: purchaseDate || undefined,
      weightG: numberOrUndefined(weightG),
      price: numberOrUndefined(price),
      tastingNotes: tastingNotes.trim() || undefined,
      targetRecipe: targetRecipe.trim() || undefined,
      brewMethods,
      status: status || undefined,
      rating: rating || undefined,
    }
    try {
      const created = await createBean(input)
      navigate({ name: 'bean', beanId: created.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the bean')
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg" className="h-full">
      <Row gap="md">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={back}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <Heading role="title">New bean</Heading>
      </Row>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Stack gap="lg">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ethiopia Guji Uraga" />
          </Field>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Roaster">
              <Input value={roaster} onChange={(e) => setRoaster(e.target.value)} placeholder="Half Light" />
            </Field>
            <Field label="Origin">
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Ethiopia" />
            </Field>
            <Field label="Region">
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Guji, Uraga" />
            </Field>
            <Field label="Producer">
              <Input value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Uraga washing station" />
            </Field>
            <Field label="Varietal">
              <Input value={varietal} onChange={(e) => setVarietal(e.target.value)} placeholder="Heirloom" />
            </Field>
            <Field label="Altitude (masl)">
              <Input value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="1950–2100" />
            </Field>
          </div>

          <Field label="Process">
            <Chips options={PROCESSES} value={process} onPick={setProcess} />
          </Field>

          <Field label="Roast level">
            <Chips options={ROAST_LEVELS} value={roastLevel} onPick={setRoastLevel} />
          </Field>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Roast date">
              <Input type="date" value={roastDate} onChange={(e) => setRoastDate(e.target.value)} />
            </Field>
            <Field label="Purchase date">
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
            <Field label="Weight (g)">
              <Input type="number" inputMode="numeric" value={weightG} onChange={(e) => setWeightG(e.target.value)} placeholder="250" />
            </Field>
            <Field label="Price">
              <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="22" />
            </Field>
          </div>

          <Field label="Brew methods">
            <Row gap="sm" className="flex-wrap">
              {BREW_METHODS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={brewMethods.includes(m) ? 'select' : 'quiet'}
                  onClick={() => toggleMethod(m)}
                >
                  {m}
                </Button>
              ))}
            </Row>
          </Field>

          <Field label="Target recipe">
            <Input
              value={targetRecipe}
              onChange={(e) => setTargetRecipe(e.target.value)}
              placeholder="2.5 · 18g in · 38g out · 28s"
            />
          </Field>

          <Field label="Tasting notes">
            <Input
              value={tastingNotes}
              onChange={(e) => setTastingNotes(e.target.value)}
              placeholder="Bergamot, jasmine, white peach"
            />
          </Field>

          <Field label="Status">
            <Chips options={STATUSES} value={status} onPick={setStatus} />
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

          {error ? <Text tone="ember">{error}</Text> : null}
        </Stack>
      </div>

      <Row gap="sm">
        <Button variant="primary" onClick={submit} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save bean'}
        </Button>
        <Button variant="ghost" onClick={back} disabled={saving}>
          Cancel
        </Button>
      </Row>
    </Stack>
  )
}

/** Single-select chip row: tap to pick, tap again to clear. */
function Chips({
  options,
  value,
  onPick,
}: {
  options: readonly string[]
  value: string
  onPick: (v: string) => void
}) {
  return (
    <Row gap="sm" className="flex-wrap">
      {options.map((o) => (
        <Button
          key={o}
          size="sm"
          variant={value === o ? 'select' : 'quiet'}
          onClick={() => onPick(value === o ? '' : o)}
        >
          {o}
        </Button>
      ))}
    </Row>
  )
}

function numberOrUndefined(raw: string): number | undefined {
  const s = raw.trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
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
