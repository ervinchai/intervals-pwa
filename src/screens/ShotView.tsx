import { ArrowLeft } from 'lucide-react'

import { useRouter, type ShotResult } from '@/app/router'
import type { Trace } from '@/components/shot/FlowTrace'
import { OverviewStep } from '@/components/shot/OverviewStep'
import { AsyncScreen } from '@/components/ScreenState'
import { Button, Heading, Stack, Text } from '@/components/ui'
import { numberIn } from '@/lib/coffee-utils'
import { BrewResultSchema, type BrewLogEntry, type CoffeeBean, type SavedAnalysis } from '@/lib/contracts'
import { analyseShot, fetchCoffeeBean, fetchSavedAnalysis, fetchShotRecord } from '@/lib/data'
import type { ShotRecord } from '@/lib/flow'
import { useResource } from '@/lib/useResource'

/** The flow graph is at least this wide, in milliseconds, as on the pull. */
const MIN_WINDOW_MS = 15_000

/**
 * The overview of a logged espresso brew, opened from its bean's log: the same view as after a pull, read
 * only, with the scale's flow when it read the shot and the AI's reading on request. The AI sees only the
 * shots before this one.
 */
export function ShotView({ beanId, brewId }: { beanId: string; brewId: string }) {
  const data = useResource(() => Promise.all([fetchCoffeeBean(beanId), fetchShotRecord(beanId, brewId), fetchSavedAnalysis(beanId, brewId)]), [beanId, brewId])
  return (
    <AsyncScreen resource={data} loadingLabel="Fetching shot" errorLabel="That shot would not load">
      {([bean, record, saved]) => <Shot bean={bean} record={record} saved={saved} brewId={brewId} />}
    </AsyncScreen>
  )
}

function Shot({ bean, record, saved, brewId }: { bean: CoffeeBean; record: ShotRecord | null; saved: SavedAnalysis | null; brewId: string }) {
  const { back, canGoBack, replace } = useRouter()
  // Opened from the bean, but it can load fresh (a link): then the bean takes its place.
  const leave = () => (canGoBack ? back() : replace({ name: 'bean', beanId: bean.id }))
  const brew = bean.brews.find((entry) => entry.id === brewId)

  return (
    <Stack gap="lg" className="h-full min-h-0">
      <Stack gap="xs">
        <Button variant="ghost" size="sm" className="w-fit -ml-3 px-3" onClick={leave}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {bean.name}
        </Button>
        <Heading role="hero" level={1}>
          {brew ? new Date(brew.createdAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Shot'}
        </Heading>
        <Text size="sm" tone="dim">
          {bean.roaster} · {bean.id}
          {record ? '' : ' · not read by the scale'}
        </Text>
      </Stack>

      {brew ? (
        <OverviewStep
          shot={shotOf(brew, record)}
          trace={traceOf(record)}
          traceOrigin={record?.summary.timedBy ? 0 : null}
          takenAt={brew.createdAt}
          initialAnalysis={saved ? { items: saved.items, taste: saved.taste ?? undefined, thoughtS: saved.thoughtS ?? undefined } : undefined}
          taste={{
            cup: { body: brew.body, sweetness: brew.sweetness, acidity: brew.acidity, aftertaste: brew.aftertaste },
            notes: brew.notes,
            adjustment: brew.adjustment,
          }}
          analyse={(handlers) =>
            analyseShot(bean.id, {
              grind: brew.grind ?? undefined,
              doseG: brew.doseG,
              yieldG: brew.yieldG,
              timeS: brew.timeS,
              waterTempC: brew.waterTempC,
              result: BrewResultSchema.safeParse(brew.result).data,
              record: record ?? undefined,
              brewId: brew.id,
            }, handlers)
          }
        />
      ) : (
        <Text tone="dim">That brew is not in this bean’s log.</Text>
      )}
    </Stack>
  )
}

/** A logged brew in the overview's shape. Its stop weight is not kept, so the yield stands in (the view hides it). */
function shotOf(brew: BrewLogEntry, record: ShotRecord | null): ShotResult {
  return {
    grind: numberIn(brew.grind) ?? 0,
    doseG: brew.doseG ?? 0,
    yieldG: brew.yieldG ?? 0,
    targetG: brew.yieldG ?? 0,
    tempC: brew.waterTempC ?? 0,
    timeS: brew.timeS,
    result: BrewResultSchema.safeParse(brew.result).data,
    record: record ?? undefined,
    manual: !record,
  }
}

/** The record's flow as the graph's trace. Its points start at 0 (the timer's start, or 2 s before the first flow). */
function traceOf(record: ShotRecord | null): Trace | null {
  if (!record || record.points.length === 0) return null
  const last = record.points[record.points.length - 1][0]
  return { start: 0, windowMs: Math.max(last, MIN_WINDOW_MS), points: record.points.map(([ms, , flow]) => ({ t: ms, f: flow })) }
}
