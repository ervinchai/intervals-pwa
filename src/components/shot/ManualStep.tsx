import { Button, Card, Heading, Row, Scrubber, Spacer, Stack, Text } from '@/components/ui'
import { formatShotClock } from '@/lib/coffee-utils'

/** How a yield stands against the target: "on target", "1.5 g over", "2.0 g short". */
function against(yieldG: number, targetYield: number): string {
  const difference = yieldG - targetYield
  if (Math.abs(difference) < 0.05) return 'on target'
  return `${Math.abs(difference).toFixed(1)} g ${difference > 0 ? 'over' : 'short of'} target`
}

/**
 * The pull, typed in by hand: the other way through the second step, for when there is no scale to read
 * (or no wish to use it). The yield, the shot time and the water temperature are set here, and the ratio
 * they give is shown against the target. It starts from the recipe: the yield at its target, the time at
 * its time. Moving on goes to rating the shot, as the scale does when the shot ends.
 */
export function ManualStep({
  yieldG,
  onYield,
  scaleG,
  targetYield,
  doseG,
  timeS,
  onTime,
  tempC,
  onTemp,
  onBack,
  onNext,
}: {
  yieldG: number
  onYield: (yieldG: number) => void
  /** What the scale read for this shot, when it did: shown beside the yield and one tap puts it back. */
  scaleG?: number
  /** The yield the recipe aims for, in grams. */
  targetYield: number
  /** The dose that went in, for the ratio. */
  doseG: number
  /** The shot time in seconds. */
  timeS: number
  onTime: (seconds: number) => void
  tempC: number
  onTemp: (celsius: number) => void
  onBack: () => void
  onNext: () => void
}) {
  const ratio = doseG > 0 ? yieldG / doseG : null
  return (
    <Stack gap="lg" className="min-h-0 flex-1">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem] content-start gap-3.5 overflow-y-auto">
        <Stack gap="md">
          <Card pad="lg" className="flex flex-col gap-4">
            <Heading role="label" as="span" tone="faint">
              Yield
            </Heading>
            <Row gap="lg" align="center">
              <Row gap="sm" align="baseline">
                <span className="text-[4.5rem] font-semibold leading-none tabular-nums text-ink">{yieldG.toFixed(1)}</span>
                <span className="text-xl text-ink-dim">g</span>
              </Row>
              <Spacer />
              <Scrubber className="w-64" label="Drag to adjust" value={yieldG} onChange={onYield} step={0.5} min={0} format={(value) => value.toFixed(1)} unit="g" />
            </Row>
            <Row gap="sm" align="center">
              <Text size="sm" tone="dim">
                Target {targetYield.toFixed(1)} g
              </Text>
              <Spacer />
              {Math.abs(yieldG - targetYield) > 0.05 ? (
                <Button size="sm" variant="quiet" onClick={() => onYield(targetYield)}>
                  Use {targetYield.toFixed(1)} g
                </Button>
              ) : null}
            </Row>
            {scaleG !== undefined ? (
              <Row gap="sm" align="center">
                <Text size="sm" tone="dim">
                  Scale read {scaleG.toFixed(1)} g
                </Text>
                <Spacer />
                {Math.abs(yieldG - scaleG) > 0.05 ? (
                  <Button size="sm" variant="quiet" onClick={() => onYield(scaleG)}>
                    Use {scaleG.toFixed(1)} g
                  </Button>
                ) : null}
              </Row>
            ) : null}
          </Card>

          <div className="grid grid-cols-2 gap-3.5">
            <Card pad="md">
              <Scrubber label="Time" value={timeS} onChange={onTime} step={1} min={0} format={formatShotClock} />
            </Card>
            <Card pad="md">
              <Scrubber label="Temp" value={tempC} onChange={onTemp} step={1} min={70} max={100} unit="°C" />
            </Card>
          </div>
        </Stack>

        <Card pad="md">
          <Stack gap="sm">
            <Heading role="label" as="span" tone="faint">
              Ratio
            </Heading>
            <span className="text-[3rem] font-semibold leading-none tabular-nums text-ink">{ratio !== null ? `1:${ratio.toFixed(1)}` : '—'}</span>
            <Text size="sm" className="tabular-nums" tone="dim">
              {doseG.toFixed(1)} g in · {yieldG.toFixed(1)} g out
            </Text>
            <Text size="sm" tone="faint">
              {against(yieldG, targetYield)}
            </Text>
          </Stack>
        </Card>
      </div>

      <Row gap="sm" className="shrink-0 border-t border-line pt-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Spacer />
        <Button variant="primary" onClick={onNext}>
          Next: rate
        </Button>
      </Row>
    </Stack>
  )
}
