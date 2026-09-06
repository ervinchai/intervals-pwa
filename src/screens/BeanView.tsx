import { ArrowLeft, Plus, Printer, Star, Timer } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { PrintLabelDialog } from '@/components/print'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Badge,
  Button,
  Card,
  Heading,
  Row,
  Skeleton,
  SkeletonLine,
  Spacer,
  Stack,
  Text,
} from '@/components/ui'
import type { BrewLogEntry, BrewResult, CoffeeBean } from '@/lib/contracts'
import { fetchCoffeeBean } from '@/lib/data'
import { beanLabel } from '@/lib/labels'
import { useResource } from '@/lib/useResource'

/**
 * Bean detail — reached from the catalog grid or by scanning the jar's QR
 * (`intervals://bean/<id>`). Shows the catalog facts, the current dialed-in
 * target, and the brew-log history, with a form to log the next shot.
 */
export function BeanView({ beanId }: { beanId: string }) {
  const { back, canGoBack, navigate } = useRouter()
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
                  onAdd={() => navigate({ name: 'brew', beanId: data.id })}
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

function BrewLog({ bean, onAdd }: { bean: CoffeeBean; onAdd: () => void }) {
  return (
    <Stack gap="md">
      <Row>
        <Heading role="section">Brew log</Heading>
        <Spacer />
        <Button size="icon" aria-label="Log a shot" onClick={onAdd}>
          <Plus className="h-6 w-6" />
        </Button>
      </Row>

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
