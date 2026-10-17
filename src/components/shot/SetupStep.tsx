import { Badge, Button, Card, Heading, Row, RulerSlider, Scrubber, Spacer, Stack, Text } from '@/components/ui'
import type { BrewLogEntry } from '@/lib/contracts'
import { formatBrewTime, formatShortDate, type GrindAdvice } from '@/lib/coffee-utils'

/** How a result reads as a badge: sour and bitter are the two ways to be off, balanced is the aim. */
const RESULT_TONE = { 'Sour / Under': 'ember', Balanced: 'sage', 'Bitter / Over': 'clay' } as const

/**
 * The first step: set up the shot, the grinder and the dose together. Before touching the grinder, the
 * screen says how the last espresso went and, if it was off, which way to move (finer for sour, coarser
 * for bitter) with a number to try. The suggestion is only offered, never applied: the dial starts where
 * the last shot was pulled and "Use" moves it. The recipe's own settings are one tap away. The dose is
 * typed in (there is no dose scale in this flow). The yield to aim for stays at the recipe's, so moving
 * the dose moves the ratio, and the screen shows the ratio that will give.
 */
export function SetupStep({
  grind,
  onGrind,
  recipeGrind,
  dose,
  onDose,
  recipeDose,
  targetYield,
  last,
  advice,
  onNext,
}: {
  grind: number
  onGrind: (grind: number) => void
  /** The recipe's grind setting, when the bean has one. */
  recipeGrind: number | null
  dose: number
  onDose: (dose: number) => void
  /** The recipe's dose in grams, when the bean has one. */
  recipeDose: number | null
  /** The yield the next step will aim for, in grams. */
  targetYield: number
  /** The last espresso logged for this bean, newest first. */
  last: BrewLogEntry | undefined
  advice: GrindAdvice | null
  onNext: () => void
}) {
  const ratio = dose > 0 ? targetYield / dose : null
  return (
    <Stack gap="lg" className="min-h-0 flex-1">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_24rem] content-start gap-3.5 overflow-y-auto">
        <Stack gap="md">
          <Card pad="lg" className="flex flex-col gap-5">
            <Heading role="label" as="span" tone="faint">
              Grind setting
            </Heading>
            <RulerSlider label="Drag like the collar" value={grind} onChange={onGrind} min={0} max={16} step={0.1} minorUntil={4} />
            {recipeGrind !== null ? (
              <Row gap="sm" align="center">
                <Text size="sm" tone="dim">
                  Recipe {recipeGrind.toFixed(1)}
                </Text>
                <Spacer />
                {Math.abs(grind - recipeGrind) > 0.05 ? (
                  <Button size="sm" variant="quiet" onClick={() => onGrind(recipeGrind)}>
                    Use {recipeGrind.toFixed(1)}
                  </Button>
                ) : null}
              </Row>
            ) : null}
          </Card>

          <Card pad="lg" className="flex flex-col gap-4">
            <Heading role="label" as="span" tone="faint">
              Dose
            </Heading>
            <Row gap="lg" align="center">
              <Row gap="sm" align="baseline">
                <span className="text-[4.5rem] font-semibold leading-none tabular-nums text-ink">{dose.toFixed(1)}</span>
                <span className="text-xl text-ink-dim">g</span>
              </Row>
              <Spacer />
              <Scrubber className="w-64" label="Drag to adjust" value={dose} onChange={onDose} step={0.1} min={0} format={(value) => value.toFixed(1)} unit="g" />
            </Row>
            {recipeDose !== null ? (
              <Row gap="sm" align="center">
                <Text size="sm" tone="dim">
                  Recipe {recipeDose.toFixed(1)} g
                </Text>
                <Spacer />
                {Math.abs(dose - recipeDose) > 0.05 ? (
                  <Button size="sm" variant="quiet" onClick={() => onDose(recipeDose)}>
                    Use {recipeDose.toFixed(1)} g
                  </Button>
                ) : null}
              </Row>
            ) : null}
          </Card>
        </Stack>

        <Stack gap="md">
          {advice ? (
            <div className="rounded-card border border-ember/45 bg-ember/12 p-4.5">
              <Stack gap="sm">
                <Heading role="label" as="span" tone="faint">
                  Suggestion
                </Heading>
                <Text className="text-[1.25rem] font-semibold tabular-nums text-ember">
                  Try {advice.grind.toFixed(1)} · {advice.direction}
                </Text>
                <Text size="sm" tone="dim">
                  {advice.reason}.
                </Text>
                <Button size="sm" variant="quiet" className="w-fit" onClick={() => onGrind(advice.grind)} disabled={Math.abs(grind - advice.grind) < 0.05}>
                  {Math.abs(grind - advice.grind) < 0.05 ? `On ${advice.grind.toFixed(1)}` : `Use ${advice.grind.toFixed(1)}`}
                </Button>
              </Stack>
            </div>
          ) : null}

          <Card pad="md">
            <Stack gap="sm">
              <Row gap="sm" align="baseline">
                <Heading role="label" as="span" tone="faint">
                  Last shot
                </Heading>
                <Spacer />
                {last ? (
                  <Text size="xs" tone="faint">
                    {formatShortDate(last.createdAt)}
                  </Text>
                ) : null}
              </Row>
              {last ? (
                <>
                  <Row gap="sm" align="center" className="flex-wrap">
                    {last.result ? <Badge tone={RESULT_TONE[last.result as keyof typeof RESULT_TONE] ?? 'neutral'}>{last.result}</Badge> : <Text size="sm" tone="faint">No result recorded</Text>}
                  </Row>
                  <Text size="sm" className="tabular-nums">
                    {[last.grind ? `grind ${last.grind}` : null, last.doseG != null && last.yieldG != null ? `${last.doseG}g → ${last.yieldG}g` : null, last.timeS != null ? formatBrewTime(last.timeS) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {last.adjustment ? (
                    <Text size="sm" tone="dim">
                      → {last.adjustment}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text size="sm" tone="dim">
                  No espresso logged for this bean yet. Start from the recipe.
                </Text>
              )}
            </Stack>
          </Card>

          <Card pad="md">
            <Stack gap="sm">
              <Heading role="label" as="span" tone="faint">
                Aiming for
              </Heading>
              <Row gap="sm" align="baseline">
                <span className="text-[3rem] font-semibold leading-none tabular-nums text-ink">{targetYield.toFixed(1)}</span>
                <span className="text-xl text-ink-dim">g out</span>
              </Row>
              <Text size="sm" className="tabular-nums" tone="dim">
                {ratio !== null ? `Ratio 1:${ratio.toFixed(1)}` : '—'}
              </Text>
              <Text size="sm" tone="faint">
                The target stays at the recipe’s yield, so the ratio moves with the dose.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </div>

      <Row gap="sm" className="shrink-0 border-t border-line pt-3">
        <Spacer />
        <Button variant="primary" onClick={onNext}>
          Next: pull
        </Button>
      </Row>
    </Stack>
  )
}
