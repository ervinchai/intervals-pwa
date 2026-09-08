import { ArrowLeft, Coffee, Plus, Printer, Target } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { PrintLabelDialog } from '@/components/print'
import { RecipeSheet } from './RecipeSheet'
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
import type { BrewLogEntry, BrewResult } from '@/lib/contracts'
import { fetchCoffeeBean } from '@/lib/data'
import { beanLabel } from '@/lib/labels'
import { daysOffRoast, freshness, parseTarget } from '@/lib/coffee-utils'
import { useResource } from '@/lib/useResource'

const LOG_COLS = '52px 58px 58px 58px 54px 52px minmax(0,1fr)'

export function BeanView({ beanId }: { beanId: string }) {
  const { back, canGoBack, navigate } = useRouter()
  const bean = useResource(() => fetchCoffeeBean(beanId), [beanId])
  const [printing, setPrinting] = useState(false)
  const [sheetBrew, setSheetBrew] = useState<BrewLogEntry | null>(null)

  return (
    <AsyncScreen
      resource={bean}
      loadingLabel="Fetching bean"
      errorLabel="That bean would not load"
      skeleton={<BeanSkeleton />}
    >
      {(data) => {
        const target = parseTarget(data.targetRecipe)
        const targetBrew = data.brews.find((b) => b.isTarget) ?? null
        const days = daysOffRoast(data.roastDateLabel)
        const fresh = freshness(days)
        const last = data.brews.length > 0 ? data.brews[data.brews.length - 1] : null

        return (
          <Stack gap="lg" className="h-full min-h-0 overflow-hidden">
            <Row gap="md">
              {canGoBack ? (
                <Button variant="ghost" size="icon" aria-label="Back" onClick={back}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : null}
              <Stack gap="none" className="min-w-0">
                <Heading role="hero" level={1} className="min-w-0">
                  {data.name}
                </Heading>
                <Text size="sm" tone="dim">
                  {data.roaster} · {data.id} · {data.status}
                </Text>
              </Stack>
              <Spacer />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Print label"
                onClick={() => setPrinting(true)}
              >
                <Printer className="h-5 w-5" />
              </Button>
            </Row>

            <PrintLabelDialog
              label={beanLabel(data)}
              open={printing}
              onClose={() => setPrinting(false)}
            />

            <Card pad="md">
              <Row gap="xl">
                {target ? (
                  <>
                    <button
                      type="button"
                      disabled={!targetBrew}
                      onClick={() => targetBrew && setSheetBrew(targetBrew)}
                      className="text-left enabled:cursor-pointer"
                      aria-label={targetBrew ? 'Open target recipe card' : undefined}
                    >
                      <Stack gap="none">
                        <Row gap="xs" align="center">
                          <Text size="xs" tone="faint">Target</Text>
                          {targetBrew ? <Target className="h-3.5 w-3.5 text-ember" /> : null}
                        </Row>
                        <Row gap="md" align="baseline">
                          {Object.entries({
                            grind: target.grind,
                            in: target.dose,
                            out: target.yield,
                            time: target.time,
                          }).map(([k, v]) => (
                            <Row key={k} gap="xs" align="baseline">
                              <span className="text-[1.75rem] font-semibold tabular-nums text-ember">
                                {String(v).replace(/[a-z]+$/i, '')}
                              </span>
                              <Text size="xs" tone="faint">{k}</Text>
                            </Row>
                          ))}
                        </Row>
                      </Stack>
                    </button>
                    <div className="w-px self-stretch bg-line" />
                  </>
                ) : null}

                <Stack gap="none">
                  <Text size="xs" tone="faint">Freshness</Text>
                  <Row gap="sm" align="baseline">
                    <span
                      className="text-[1.75rem] font-semibold tabular-nums"
                      style={{
                        color:
                          fresh.tone === 'clay'
                            ? 'var(--color-clay)'
                            : fresh.tone === 'sage'
                              ? 'var(--color-sage)'
                              : 'var(--color-ink)',
                      }}
                    >
                      {days != null ? days : '—'}
                    </span>
                    <Text size="xs" tone="faint">
                      days off roast {fresh.note ? `· ${fresh.note}` : ''}
                    </Text>
                  </Row>
                </Stack>

                <Spacer />
                {last && last.result ? (
                  <Badge tone={resultTone(last.result)}>Last: {last.result}</Badge>
                ) : null}
                <Button onClick={() => navigate({ name: 'brew', beanId: data.id })}>
                  <Coffee className="mr-1.5 h-[18px] w-[18px]" />Dial in
                </Button>
              </Row>
            </Card>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_268px] gap-5">
              <Stack gap="sm" className="min-h-0">
                <Row>
                  <Heading role="section">Brew log</Heading>
                  <Text size="xs" tone="faint" className="ml-2">
                    {data.brews.length} shots · newest last
                  </Text>
                  <Spacer />
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => navigate({ name: 'brew', beanId: data.id })}
                  >
                    <Plus className="mr-1 h-4 w-4" />Log a shot
                  </Button>
                </Row>
                <Card pad="none" className="min-h-0 flex-1 overflow-y-auto pt-3">
                  {data.brews.length === 0 ? (
                    <Stack gap="sm" align="start" className="p-[14px]">
                      <Text size="sm" tone="faint">No brews logged yet. Dial one in.</Text>
                      <Button size="sm" onClick={() => navigate({ name: 'brew', beanId: data.id })}>
                        Dial in
                      </Button>
                    </Stack>
                  ) : (
                    <>
                      <LogHead />
                      {data.brews.map((b, i) => (
                        <LogRow
                          key={b.id}
                          brew={b}
                          isLatest={i === data.brews.length - 1}
                          onOpen={() => setSheetBrew(b)}
                        />
                      ))}
                    </>
                  )}
                </Card>
              </Stack>

              <Stack gap="lg" className="min-h-0 overflow-y-auto pr-2">
                <FactGroup title="Provenance">
                  <Fact label="Origin" value={data.origin} />
                  <Fact label="Region" value={data.region} />
                  <Fact label="Producer" value={data.producer} />
                  <Fact label="Varietal" value={data.varietal} />
                  <Fact label="Altitude" value={data.altitude} />
                  <Fact label="Process" value={data.process} />
                </FactGroup>

                <FactGroup title="This bag">
                  <Fact label="Roast" value={data.roastLevel} />
                  <Fact label="Roasted" value={data.roastDateLabel} />
                  <Fact label="Bought" value={data.purchaseDateLabel} />
                  <Fact label="Weight" value={data.weightG ? `${data.weightG} g` : undefined} />
                  <Fact label="Price" value={data.price ? `£${data.price}` : undefined} />
                  <Fact label="Profile" value={data.brewMethods?.length ? data.brewMethods.join(', ') : undefined} />
                </FactGroup>

                <FactGroup title="In the cup">
                  {data.tastingNotes ? <Text size="sm" tone="dim">{data.tastingNotes}</Text> : null}
                </FactGroup>
              </Stack>
            </div>

            <RecipeSheet
              brew={sheetBrew}
              beanName={data.name}
              open={sheetBrew != null}
              onClose={() => setSheetBrew(null)}
            />
          </Stack>
        )
      }}
    </AsyncScreen>
  )
}

function FactGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Heading role="label" as="span" tone="faint">{title}</Heading>
      <Stack gap="xs">{children}</Stack>
    </Stack>
  )
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[68px_minmax(0,1fr)] items-baseline gap-[10px]">
      <Text size="xs" tone="faint">{label}</Text>
      <Text size="sm">{value}</Text>
    </div>
  )
}

function LogHead() {
  return (
    <div
      className="grid gap-[10px] border-b border-line px-[14px] pb-1.5"
      style={{ gridTemplateColumns: LOG_COLS }}
    >
      {['Grind', 'Dose', 'Yield', 'Ratio', 'Time', 'Temp', 'Result'].map((h) => (
        <Text key={h} size="xs" tone="faint" className="font-semibold uppercase tracking-[0.08em]">{h}</Text>
      ))}
    </div>
  )
}

function LogRow({
  brew,
  isLatest,
  onOpen,
}: {
  brew: BrewLogEntry
  isLatest: boolean
  onOpen: () => void
}) {
  const cell = 'font-sans text-[0.9375rem] tabular-nums text-ink'
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open recipe card for the ${brew.dateLabel} brew`}
      className="block w-full cursor-pointer border-b border-line px-[14px] py-2.5 text-left transition-[background-color] duration-150 hover:brightness-105 active:bg-raised"
      style={{
        background:
          brew.isTarget
            ? 'color-mix(in srgb, var(--color-ember) 20%, transparent)'
            : isLatest
              ? 'color-mix(in srgb, var(--color-ember) 12%, transparent)'
              : 'transparent',
      }}
    >
      <div className="grid items-center gap-[10px]" style={{ gridTemplateColumns: LOG_COLS }}>
        <span className={cell}>{brew.grind}</span>
        <span className={cell}>{brew.doseG}<span className="text-ink-faint">g</span></span>
        <span className={cell}>{brew.yieldG}<span className="text-ink-faint">g</span></span>
        <span className={`${cell} font-semibold text-ember`}>1:{brew.ratio}</span>
        <span className={cell}>{brew.timeS}<span className="text-ink-faint">s</span></span>
        <span className={cell}>{brew.waterTempC}<span className="text-ink-faint">°</span></span>
        <Row gap="sm" align="center" justify="between">
          <Row gap="sm" align="center">
            {brew.isTarget ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 text-ember">
                <Target className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Target</span>
              </span>
            ) : null}
            {brew.result ? <Badge tone={resultTone(brew.result)}>{brew.result}</Badge> : null}
          </Row>
          <Text size="xs" tone="faint">{brew.dateLabel}</Text>
        </Row>
      </div>
      {brew.adjustment ? (
        <Text size="sm" tone="dim" className="mt-1 block">→ {brew.adjustment}</Text>
      ) : null}
    </button>
  )
}

function resultTone(result: BrewResult | undefined): 'sage' | 'clay' | 'neutral' {
  if (result === 'Balanced') return 'sage'
  if (result === 'Bitter / Over') return 'clay'
  return 'neutral'
}

function BeanSkeleton() {
  return (
    <Stack gap="lg" className="h-full min-h-0 overflow-hidden">
      <Row gap="md">
        <Heading role="hero" level={1} className="w-64">
          <SkeletonLine />
        </Heading>
      </Row>
      <Card pad="md">
        <Skeleton className="h-[4.5rem]" />
      </Card>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_268px] gap-5">
        <Skeleton className="h-full rounded-card" />
        <Skeleton className="h-full rounded-card" />
      </div>
    </Stack>
  )
}
