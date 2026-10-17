import { ArrowLeft } from 'lucide-react'
import { useCallback, useState } from 'react'

import { useRouter, type ShotResult } from '@/app/router'
import { ManualStep } from '@/components/shot/ManualStep'
import { PullStep } from '@/components/shot/PullStep'
import { SetupStep } from '@/components/shot/SetupStep'
import { StepRail, type RailStep } from '@/components/shot/StepRail'
import { AsyncScreen } from '@/components/ScreenState'
import { Badge, Button, Heading, Row, Spacer, Stack, Text } from '@/components/ui'
import type { CoffeeBean } from '@/lib/contracts'
import { lastBrewTemp, numberIn, parseTarget, startingGrind, suggestGrind } from '@/lib/coffee-utils'
import { fetchCoffeeBean } from '@/lib/data'
import { useResource } from '@/lib/useResource'

/** The shot time to start from when the recipe has none, in seconds. It is only used when the shot is typed in. */
const FALLBACK_TIME_S = 28

/** The yield to aim for when the bean has no recipe yet, in grams. It can be changed on the pull. */
const FALLBACK_YIELD_G = 36

/**
 * Making an espresso, as one flow with a rail across the top: Grind and dose, Pull, Rate. Each step is
 * one thing to do. The first shows how the last shot went, suggests which way to move the dial, and
 * takes the dose, typed in. The pull has two ways through, swapped with a switch: the scale under the
 * cup, which says when to stop and moves on by itself when the flow stops, or typing in the yield, time
 * and temperature by hand. Either ends in rating the shot, with everything already filled in. The rail
 * keeps what was settled in each step, so a glance says what went into the cup. Back on the rating comes
 * here again (`shot`), on the by-hand pull with the numbers kept. Once the scale has read a shot it is not
 * offered again: the reading is the starting point to edit.
 */
export function Espresso({ beanId, shot }: { beanId: string; shot?: ShotResult }) {
  const bean = useResource(() => fetchCoffeeBean(beanId), [beanId])
  return (
    <AsyncScreen resource={bean} loadingLabel="Fetching bean" errorLabel="That bean would not load">
      {(data) => <Flow bean={data} shot={shot} />}
    </AsyncScreen>
  )
}

type PullMode = 'scale' | 'manual'

function Flow({ bean, shot }: { bean: CoffeeBean; shot?: ShotResult }) {
  const { back, canGoBack, replace } = useRouter()
  // Reached from its bean, but it can load fresh (a reload, a link, a push from Home Assistant): then there is
  // nothing behind it, and the bean takes its place. Pushing the bean on top would make back go round in a circle.
  const leave = () => (canGoBack ? back() : replace({ name: 'bean', beanId: bean.id }))

  const recipe = parseTarget(bean.targetRecipe)
  const recipeGrind = numberIn(recipe?.grind)
  const recipeDose = numberIn(recipe?.dose)
  const targetYield = numberIn(recipe?.yield) ?? FALLBACK_YIELD_G
  // The last espresso, newest first: the suggestion and the starting grind come from it.
  const last = bean.brews.find((brew) => brew.method === 'Espresso')
  const advice = suggestGrind(last, recipeGrind)

  // Coming back from the rating (`shot`) reopens the pull, always by hand: a shot the scale has read is
  // edited, not read again. The scale's own reading is kept (`scaleG`) so it can be put back.
  const scaleG = shot?.scaleG
  const [step, setStep] = useState(shot ? 1 : 0)
  const [mode, setMode] = useState<PullMode>(shot ? 'manual' : 'scale')
  // The pump is on: leaving the pull now would drop the shot, so every way out waits (the pull's own Back does too).
  const [pumping, setPumping] = useState(false)
  // With a suggestion the dial starts where the last shot was pulled, so the suggested change is a
  // move from what it shows; without one it starts from the recipe.
  const [grind, setGrind] = useState(() => shot?.grind ?? startingGrind(advice, last, recipeGrind))
  const [dose, setDose] = useState(() => shot?.doseG ?? recipeDose ?? 18)
  // The water temperature is chosen on the pull, in either mode. The yield and time are typed in only by hand.
  const [temp, setTemp] = useState(() => shot?.tempC ?? lastBrewTemp())
  const [handYield, setHandYield] = useState(() => shot?.yieldG ?? targetYield)
  const [handTime, setHandTime] = useState(() => shot?.timeS ?? numberIn(recipe?.time) ?? FALLBACK_TIME_S)

  // The shot is over: on to rating it, with the whole shot carried across. It replaces this screen, so
  // saving the brew goes back to the bean.
  const handleFinished = useCallback(
    (result: { yieldG: number; targetG: number }) => {
      replace({ name: 'brew', beanId: bean.id, shot: { ...result, scaleG: result.yieldG, doseG: dose, grind, tempC: temp } })
    },
    [replace, bean.id, dose, grind, temp],
  )

  // The numbers typed in by hand: on to rating the shot, with them filled in.
  const handleHandDone = () => {
    replace({
      name: 'brew',
      beanId: bean.id,
      shot: { grind, doseG: dose, yieldG: handYield, targetG: targetYield, scaleG, timeS: handTime, tempC: temp, manual: true },
    })
  }

  const steps: RailStep[] = [
    { label: 'Grind & dose', summary: step > 0 ? `${grind.toFixed(1)} · ${dose.toFixed(1)} g` : undefined },
    { label: 'Pull' },
    { label: 'Rate' },
  ]

  return (
    <Stack gap="lg" className="h-full min-h-0">
      <Stack gap="xs">
        <Button variant="ghost" size="sm" className="w-fit -ml-3 px-3" onClick={leave} disabled={pumping}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {bean.name}
        </Button>
        <Row gap="md">
          <Stack gap="none" className="min-w-0">
            <Heading role="hero" level={1}>
              Make espresso
            </Heading>
            <Text size="sm" tone="dim">
              {bean.roaster} · {bean.id}
            </Text>
          </Stack>
          <Spacer />
          {step === 1 && scaleG !== undefined ? <Badge tone="neutral">Scale read {scaleG.toFixed(1)} g</Badge> : null}
          {step === 1 && scaleG === undefined ? (
            <Row gap="sm" align="center">
              {/* Swapping unmounts the other way through, so it waits while the pump runs. */}
              <Button size="sm" variant={mode === 'scale' ? 'select' : 'quiet'} aria-pressed={mode === 'scale'} onClick={() => setMode('scale')} disabled={pumping}>
                Scale
              </Button>
              <Button size="sm" variant={mode === 'manual' ? 'select' : 'quiet'} aria-pressed={mode === 'manual'} onClick={() => setMode('manual')} disabled={pumping}>
                By hand
              </Button>
            </Row>
          ) : null}
        </Row>
      </Stack>

      <StepRail steps={steps} current={step} onJump={pumping ? undefined : setStep} />

      {step === 0 ? (
        <SetupStep
          grind={grind}
          onGrind={setGrind}
          recipeGrind={recipeGrind}
          dose={dose}
          onDose={setDose}
          recipeDose={recipeDose}
          targetYield={targetYield}
          last={last}
          advice={advice}
          onNext={() => setStep(1)}
        />
      ) : mode === 'scale' ? (
        <PullStep
          targetG={targetYield}
          doseG={dose}
          tempC={temp}
          onTemp={setTemp}
          onBack={() => setStep(0)}
          onFinished={handleFinished}
          onRunningChange={setPumping}
        />
      ) : (
        <ManualStep
          yieldG={handYield}
          onYield={setHandYield}
          scaleG={scaleG}
          targetYield={targetYield}
          doseG={dose}
          timeS={handTime}
          onTime={setHandTime}
          tempC={temp}
          onTemp={setTemp}
          onBack={() => setStep(0)}
          onNext={handleHandDone}
        />
      )}
    </Stack>
  )
}
