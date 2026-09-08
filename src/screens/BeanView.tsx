import { ArrowLeft, Plus, Printer, Target, X } from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { fetchCoffeeBean, setTargetBrew } from '@/lib/data'
import { beanLabel } from '@/lib/labels'
import {
  daysOffRoast,
  formatBrewTime,
  formatClockTime,
  formatShortDate,
  parseTarget,
  roastCurve,
} from '@/lib/coffee-utils'
import { useResource } from '@/lib/useResource'

const LOG_COLS = '64px 60px 66px 66px 66px 60px 56px minmax(0,1fr) 32px'
/** Width of the vertical date rail that runs down the left of the brew log. */
const DATE_COL_WIDTH = 28
/** Days of run-off past the stale point the freshness timeline plots, so the red end doesn't feel clipped right at the boundary. */
const STALE_BUFFER_DAYS = 1

export function BeanView({ beanId }: { beanId: string }) {
  const { back, canGoBack, navigate } = useRouter()
  const bean = useResource(() => fetchCoffeeBean(beanId), [beanId])
  const [printing, setPrinting] = useState(false)
  const [selectedBrew, setSelectedBrew] = useState<BrewLogEntry | null>(null)
  // Holds the freshest bean after "Mark as target" writes back, so the target
  // line and each brew's isTarget flag update in place — a full `reload()`
  // would flash the whole screen back to its loading skeleton. Cleared
  // whenever the underlying fetch produces a new bean (bean switch or an
  // actual reload), so it never outlives the data it patched.
  const [beanOverride, setBeanOverride] = useState<CoffeeBean | null>(null)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    setBeanOverride(null)
  }, [bean.data])

  async function handleMarkTarget(brew: BrewLogEntry) {
    setMarking(true)
    try {
      const updated = await setTargetBrew(beanId, brew.id)
      setBeanOverride(updated)
      setSelectedBrew(updated.brews.find((b) => b.id === brew.id) ?? null)
    } finally {
      setMarking(false)
    }
  }

  return (
    <AsyncScreen
      resource={bean}
      loadingLabel="Fetching bean"
      errorLabel="That bean would not load"
      skeleton={<BeanSkeleton />}
    >
      {(fetched) => {
        const data = beanOverride ?? fetched
        const target = parseTarget(data.targetRecipe)
        // target.dose/.yield carry their unit inline (e.g. "18g in"); strip
        // the trailing word so DetailStat's own number+label pairing doesn't
        // repeat it. target.time is bare seconds (e.g. "28") — format with
        // real units (29s, 1m40s) rather than showing a naked number.
        const targetDose = target?.dose.replace(/[a-z]+$/i, '')
        const targetYield = target?.yield.replace(/[a-z]+$/i, '')
        const targetTime = target ? formatBrewTime(parseInt(target.time, 10)) : undefined
        const targetBrew = data.brews.find((b) => b.isTarget) ?? null
        const last = data.brews.length > 0 ? data.brews[data.brews.length - 1] : null

        return (
          <Stack gap="lg" className="h-full min-h-0 overflow-hidden">
            <Stack gap="xs">
              {canGoBack ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit -ml-3 px-3"
                  onClick={back}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Beans
                </Button>
              ) : null}
              <Row gap="md">
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
            </Stack>

            <PrintLabelDialog
              label={beanLabel(data)}
              open={printing}
              onClose={() => setPrinting(false)}
            />

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_332px] gap-5">
              {/* Left: at-a-glance summary, then the brew log fills the rest */}
              <Stack gap="sm" className="min-h-0">
                <Card pad="md" className="mb-4">
                  <Stack gap="md">
                    <Row gap="xl" align="start">
                      <Stack gap="sm" className="min-w-0 flex-1">
                        <FreshnessTimeline roastDate={data.roastDate} roastLevel={data.roastLevel} />
                      </Stack>

                      {last && last.result ? (
                        <Badge tone={resultTone(last.result)}>Last: {last.result}</Badge>
                      ) : null}
                    </Row>
                  </Stack>
                </Card>

                <Row>
                  <Heading role="section">Brew log</Heading>
                  <Text size="xs" tone="faint" className="ml-2">
                    {data.brews.length} shots · newest last
                  </Text>
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
                      <div className="relative">
                        <div
                          className="absolute inset-y-0 left-0 border-r border-line"
                          style={{ width: DATE_COL_WIDTH }}
                        />
                        {groupBrewsByDate(data.brews).map((group, i) => (
                          <DateGroup
                            key={group.brews[0].id}
                            dateLabel={group.dateLabel}
                            brews={group.brews}
                            isFirst={i === 0}
                            selectedBrewId={selectedBrew?.id ?? null}
                            onOpen={setSelectedBrew}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              </Stack>

              {/* Right: bean facts by default; the tapped brew's detail when viewing */}
              <Stack gap="xl" className="min-h-0 overflow-y-auto pr-1">
                {selectedBrew ? (
                  <BrewDetail
                    brew={selectedBrew}
                    onBack={() => setSelectedBrew(null)}
                    onMarkTarget={() => handleMarkTarget(selectedBrew)}
                    marking={marking}
                  />
                ) : (
                  <>
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
                      <Fact label="Roasted" value={formatShortDate(data.roastDate)} />
                      <Fact label="Bought" value={formatShortDate(data.purchaseDate)} />
                      <Fact label="Weight" value={data.weightG ? `${data.weightG} g` : undefined} />
                      <Fact label="Price" value={data.price ? `RM${data.price.toFixed(2)}` : undefined} />
                      <Fact label="Profile" value={data.brewMethods?.length ? data.brewMethods.join(', ') : undefined} />
                    </FactGroup>

                    <FactGroup title="In the cup">
                      {data.tastingNotes ? <Text size="sm" tone="dim">{data.tastingNotes}</Text> : null}
                    </FactGroup>
                  </>
                )}

                {target ? (
                  <>
                    <div className="border-t border-line" />
                    <button
                      type="button"
                      disabled={!targetBrew}
                      onClick={() => targetBrew && setSelectedBrew(targetBrew)}
                      className="text-left enabled:cursor-pointer"
                      aria-label={targetBrew ? 'View target recipe' : undefined}
                    >
                      <Stack gap="sm">
                        <Row gap="xs" align="center">
                          <Heading role="label" as="span" tone="faint">Target Recipe</Heading>
                          {targetBrew ? <Target className="h-3.5 w-3.5 text-ember" /> : null}
                        </Row>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <DetailStat label="grind" value={target.grind} accent />
                          <DetailStat label="in" value={targetDose} accent />
                          <DetailStat label="out" value={targetYield} accent />
                          <DetailStat label="time" value={targetTime} accent />
                        </div>
                      </Stack>
                    </button>
                  </>
                ) : null}

                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => navigate({ name: 'brew', beanId: data.id })}
                >
                  <Plus className="mr-1 h-4 w-4" />Add brew log
                </Button>
              </Stack>
            </div>
          </Stack>
        )
      }}
    </AsyncScreen>
  )
}

/**
 * A gradient strip plotting the bean's whole freshness lifecycle — roast day
 * through `STALE_BUFFER_DAYS` past its stale point (a little run-off so the
 * red end doesn't feel clipped right at the boundary) — at the days-off-roast
 * milestones for this bean's roast level: orange (resting) through the entry
 * into a green plateau (its peak window), then a continuous fade back through
 * orange to red (stale). Entering peak is a tight, obvious boundary; leaving
 * it is a genuine gradual fade, so it isn't banded the same way. Ticks poke
 * past the bar edge at the milestones that *are* hard boundaries (peak
 * start/end, stale). The current phase is labeled in words directly above the
 * "today" marker — anchored to the marker's own position, not fixed to one
 * side, so it can't be read as saying where a zone sits. Absolute time reads
 * as a lifecycle better than a today-relative window, so this always shows
 * the full span rather than toggling. Hidden with no roast date.
 */
function FreshnessTimeline({
  roastDate,
  roastLevel,
}: {
  roastDate?: string
  roastLevel?: string
}) {
  const daysOld = daysOffRoast(roastDate)
  if (daysOld == null) return null

  const { peakStart, peakEnd, stale } = roastCurve(roastLevel)
  const windowStart = 0
  const windowEnd = stale + STALE_BUFFER_DAYS
  const span = windowEnd - windowStart

  const pos = (day: number) => Math.min(100, Math.max(0, ((day - windowStart) / span) * 100))

  // A punchier trio than the app's muted content palette (ember/sage/clay) —
  // this bar is a status signal, not decorative content, so green/orange/red
  // need to read as clearly distinct at a glance rather than blend together.
  const ORANGE = '#e2933f'
  const GREEN = '#3fae54'
  const RED = '#d1453d'
  const fadeMidDay = (peakEnd + stale) / 2
  // The solid color for a given day, used only to color the bar's two edges
  // (0%/100%) and to decide which internal milestones are actually visible.
  // The fade zone (peakEnd..stale) is approximated as a hard split at its
  // midpoint here — fine for an edge color, since the real fade is rendered
  // as a proper gradient below when its midpoint is in view.
  const zoneColor = (day: number): string => {
    if (day < peakStart) return ORANGE
    if (day <= peakEnd) return GREEN
    if (day < fadeMidDay) return GREEN
    if (day < stale) return ORANGE
    return RED
  }

  // Unclamped day→% (can go negative or past 100), unlike `pos`. Used to
  // decide which milestones actually land inside the visible window — if we
  // clamped first, several off-window milestones (e.g. every one of them,
  // when the bean is long past stale) would all collapse onto the same 0%/
  // 100% edge, producing an invalid, visually broken gradient (a sliver of
  // every color squeezed into a few percent instead of one solid color).
  const rawPos = (day: number) => ((day - windowStart) / span) * 100
  const inView = (p: number) => p > 0 && p < 100

  // Half-width (in %) of the soft edge around entering the peak window —
  // narrow enough that the resting and peak zones read as solid colors, not
  // a smear. Leaving peak has no such edge: the "Flat (Fading)" stretch from
  // peakEnd to stale is a genuine continuous fade, not another hard zone, so
  // it's a plain green → orange → red interpolation with an orange waypoint
  // at its midpoint (otherwise RGB would blend green straight to red through
  // a muddy brown).
  const EDGE = 3
  const milestoneStops = [
    { pct: rawPos(peakStart) - EDGE, color: ORANGE },
    { pct: rawPos(peakStart) + EDGE, color: GREEN },
    { pct: rawPos(peakEnd), color: GREEN },
    { pct: rawPos(fadeMidDay), color: ORANGE },
    { pct: rawPos(stale), color: RED },
  ].filter((s) => inView(s.pct))

  const stops = [
    { pct: 0, color: zoneColor(windowStart) },
    ...milestoneStops,
    { pct: 100, color: zoneColor(windowEnd) },
  ]
  const gradient = `linear-gradient(to right, ${stops.map((s) => `${s.color} ${s.pct}%`).join(', ')})`

  const phase =
    daysOld < peakStart
      ? { text: 'Not peaked', tone: ORANGE }
      : daysOld <= peakEnd
        ? { text: 'At peak', tone: GREEN }
        : daysOld < stale
          ? { text: 'Fading', tone: ORANGE }
          : { text: 'Stale', tone: RED }

  const markerPct = pos(daysOld)
  // Anchor the label to whichever side of the marker has room, so it always
  // grows away from its nearest edge instead of overflowing it. Centering
  // (translateX(-50%)) isn't safe at any marker position — a long phase word
  // like "NOT PEAKED" is wide enough to clip past the edge even when the
  // marker itself is a good way in (e.g. ~25%), not just at the extremes.
  const labelStyle: React.CSSProperties =
    markerPct < 50
      ? { left: `calc(${markerPct}% - 2px)`, textAlign: 'left', color: phase.tone }
      : { right: `calc(${100 - markerPct}% - 2px)`, textAlign: 'right', color: phase.tone }

  return (
    <div
      className="relative pt-4"
      role="img"
      aria-label={`Freshness timeline: ${phase.text}, ${daysOld} days after roast, stale at ${stale} days`}
    >
      {/* The day count travels with the marker rather than living as a separate,
          disconnected stat — so "what phase, as of which day" reads as one fact. */}
      <span
        className="absolute -top-0.5 whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.04em] tabular-nums"
        style={labelStyle}
      >
        {phase.text} · {daysOld}d after roast
      </span>
      <div className="relative h-3 rounded-full" style={{ background: gradient }}>
        {[rawPos(peakStart), rawPos(peakEnd), rawPos(stale)].filter(inView).map((p) => (
          <div
            key={p}
            className="absolute w-[3px] rounded-full bg-void/70"
            style={{ left: `${p}%`, top: -2, bottom: -2, transform: 'translateX(-50%)' }}
            aria-hidden
          />
        ))}
        {daysOld > windowEnd ? (
          // Past the plotted range entirely — a plain circle in the bar's own
          // red, same height as the bar and no ring/shadow, so it reads as
          // the bar's own material (its rounded end, just round instead of
          // flat) rather than a separate marker-style UI element. Reads
          // better than a marker clamped inside the edge, which looked
          // identical whether 1 day or 100 days overdue.
          <div
            className="absolute top-1/2 h-[3px] w-4 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-ink"
            style={{ left: '99.5%', boxShadow: '0 0 0 2px var(--color-surface)' }}
            aria-hidden
          />
        ) : (
          <div
            className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `clamp(4px, ${markerPct}%, calc(100% - 4px))`, boxShadow: '0 0 0 2px var(--color-surface)' }}
            aria-hidden
          />
        )}
      </div>
      <Row justify="between" className="mt-1">
        <Text size="xs" tone="faint">roasted</Text>
        <Text size="xs" tone="faint" className="pr-3.5">stale at {stale}d</Text>
      </Row>
    </div>
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
    <div className="flex border-b border-line pb-2">
      <div className="grid flex-1 gap-3 pl-[120px] pr-4" style={{ gridTemplateColumns: LOG_COLS }}>
        {['Grind', 'Dose', 'Yield', 'Ratio', 'Temp', 'Time', 'Result', ''].map((h, i) => (
          <Text
            key={h || `col-${i}`}
            size="xs"
            tone="faint"
            className="font-semibold uppercase tracking-[0.08em]"
          >
            {h}
          </Text>
        ))}
      </div>
    </div>
  )
}

/** Consecutive brews sharing a calendar day (by their formatted date), so the log can merge their date rail cell. */
function groupBrewsByDate(brews: BrewLogEntry[]): { dateLabel: string; brews: BrewLogEntry[] }[] {
  const groups: { dateLabel: string; brews: BrewLogEntry[] }[] = []
  for (const brew of brews) {
    const dateLabel = formatShortDate(brew.createdAt) ?? '—'
    const current = groups[groups.length - 1]
    if (current && current.dateLabel === dateLabel) current.brews.push(brew)
    else groups.push({ dateLabel, brews: [brew] })
  }
  return groups
}

/** One date's brews, with a single vertical date label spanning the whole group. A
 *  top border marks the boundary between one date's brews and the next (skipped
 *  on the first group, which already sits under the log's own header rule). */
function DateGroup({
  dateLabel,
  brews,
  isFirst,
  selectedBrewId,
  onOpen,
}: {
  dateLabel: string
  brews: BrewLogEntry[]
  isFirst: boolean
  selectedBrewId: string | null
  onOpen: (brew: BrewLogEntry) => void
}) {
  // A single-brew group has no "span" to top-align within — center the date
  // label in its one row instead, matching how a lone row would naturally read.
  const single = brews.length === 1
  return (
    <div className="relative">
      <div
        className={`absolute inset-y-0 left-0 flex pr-px ${
          single ? 'items-center justify-center' : 'items-start pl-1.5 pt-1.5'
        }`}
        style={{ width: DATE_COL_WIDTH }}
      >
        <span
          className="whitespace-nowrap text-[0.625rem] font-semibold uppercase tracking-[0.01em] text-ink-faint"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {dateLabel}
        </span>
      </div>
      {/* Boundary border goes on this inset div (not the full-width rail above)
          so it starts at the same x as each row's own border-b, and is skipped
          on the first group so it doesn't double up with the log's header rule
          or add a stray divider under the very last group. */}
      <div className={isFirst ? '' : 'border-t border-line'} style={{ marginLeft: DATE_COL_WIDTH }}>
        {brews.map((b) => (
          <LogRow key={b.id} brew={b} isSelected={selectedBrewId === b.id} onOpen={() => onOpen(b)} />
        ))}
      </div>
    </div>
  )
}

function LogRow({
  brew,
  isSelected,
  onOpen,
}: {
  brew: BrewLogEntry
  isSelected: boolean
  onOpen: () => void
}) {
  const cell = 'font-sans text-[0.9375rem] tabular-nums text-ink'
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={isSelected}
      aria-label={`View the ${formatShortDate(brew.createdAt) ?? ''} brew`}
      className={`block w-full cursor-pointer border-b border-line px-4 py-3 text-left transition-[background-color] duration-150 hover:brightness-105 active:bg-raised ${
        isSelected ? 'shadow-[inset_3px_0_0_var(--color-ember)]' : ''
      }`}
      style={{
        background: isSelected
          ? 'color-mix(in srgb, var(--color-ember) 16%, transparent)'
          : 'transparent',
      }}
    >
      <div className="grid h-5 items-center gap-3" style={{ gridTemplateColumns: LOG_COLS }}>
        <Text size="xs" tone="faint">{formatClockTime(brew.createdAt)}</Text>
        <span className={cell}>{brew.grind}</span>
        <span className={cell}>{brew.doseG}<span className="text-ink-faint">g</span></span>
        <span className={cell}>{brew.yieldG}<span className="text-ink-faint">g</span></span>
        <span className={`${cell} font-semibold text-ember`}>1:{brew.ratio}</span>
        <span className={cell}>{brew.waterTempC}<span className="text-ink-faint">°</span></span>
        <span className={cell}>{formatBrewTime(brew.timeS)}</span>
        <Row gap="sm" align="center">
          {brew.result ? (
            <Badge tone={resultTone(brew.result)} className="px-1.5 py-0.5 text-xs leading-none">
              {brew.result}
            </Badge>
          ) : null}
        </Row>
        {brew.isTarget ? (
          <Target className="h-3.5 w-3.5 shrink-0 justify-self-end text-ember" aria-label="Target recipe" />
        ) : (
          <span />
        )}
      </div>
    </button>
  )
}

function resultTone(result: BrewResult | undefined): 'sage' | 'clay' | 'neutral' {
  if (result === 'Balanced') return 'sage'
  if (result === 'Bitter / Over') return 'clay'
  return 'neutral'
}

/**
 * The tapped brew, shown in the right pane in place of the bean facts — the
 * master-detail half of the log. Recipe numbers read at a glance; result and
 * the free-text fields sit below. `onBack` returns the pane to the facts.
 */
function BrewDetail({
  brew,
  onBack,
  onMarkTarget,
  marking,
}: {
  brew: BrewLogEntry
  onBack: () => void
  onMarkTarget: () => void
  marking: boolean
}) {
  return (
    <Stack gap="md">
      <Row gap="sm" align="center">
        <Stack gap="none" className="min-w-0">
          <Heading role="label" as="span" tone="faint">
            {brew.isTarget ? 'Target recipe' : 'Brew'}
          </Heading>
          <Text size="sm">{formatShortDate(brew.createdAt)} · {brew.method}</Text>
        </Stack>
        <Spacer />
        <Button variant="ghost" size="icon" aria-label="Close brew details" onClick={onBack}>
          <X className="h-5 w-5" />
        </Button>
      </Row>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <DetailStat label="grind" value={brew.grind} />
        <DetailStat label="ratio" value={brew.ratio != null ? `1:${brew.ratio}` : undefined} accent />
        <DetailStat label="dose" value={fmt(brew.doseG, 'g')} />
        <DetailStat label="yield" value={fmt(brew.yieldG, 'g')} />
        <DetailStat label="time" value={formatBrewTime(brew.timeS)} />
        <DetailStat label="temp" value={fmt(brew.waterTempC, '°')} />
      </div>

      {(brew.result || brew.adjustment || brew.notes) && (
        <Stack gap="sm" className="border-t border-line pt-3">
          {brew.result ? <Badge tone={resultTone(brew.result)}>{brew.result}</Badge> : null}
          {brew.adjustment ? <Text size="sm" tone="dim">→ {brew.adjustment}</Text> : null}
          {brew.notes ? <Text size="sm" tone="dim">{brew.notes}</Text> : null}
        </Stack>
      )}

      <Button variant="quiet" size="sm" onClick={onMarkTarget} disabled={marking || brew.isTarget} className="mt-4">
        <Target className="mr-0.5 h-4 w-4" />
        {brew.isTarget ? 'Already set as target recipe' : (marking ? 'Updating…' : 'Set as target recipe')}
      </Button>
    </Stack>
  )
}

/** One glanceable number for the detail pane; hidden when it has no value. */
function DetailStat({ label, value, accent }: { label: string; value?: string; accent?: boolean }) {
  if (!value) return null
  return (
    <Stack gap="none">
      <span
        className="text-[1.5rem] font-semibold leading-none tabular-nums"
        style={{ color: accent ? 'var(--color-ember)' : 'var(--color-ink)' }}
      >
        {value}
      </span>
      <Text size="xs" tone="faint">{label}</Text>
    </Stack>
  )
}

function fmt(v: number | undefined, unit: string): string | undefined {
  return v != null ? `${v}${unit}` : undefined
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
