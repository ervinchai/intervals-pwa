import { ArrowLeft, Clock, CookingPot, UsersRound } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Badge,
  Button,
  Card,
  Checklist,
  ChecklistItem,
  Heading,
  Image,
  Row,
  Skeleton,
  SkeletonLine,
  SkeletonText,
  Spacer,
  Stack,
  Step,
  Steps,
  Text,
} from '@/components/ui'
import type { Ingredient, Recipe } from '@/lib/contracts'
import { fetchRecipe } from '@/lib/data'
import { useResource } from '@/lib/useResource'

type Tab = 'prep' | 'cook'

/**
 * Recipe detail — the screen the hub exists for.
 *
 * Split into two tabs. **Prep** pins the ingredients beside the mise-en-place so
 * you gather and ready everything first; **Cook** is the method proper, walked a
 * step at a time. Keeping them apart means the wall shows only what the current
 * phase of the cook needs.
 */
export function RecipeView({ recipeId }: { recipeId: string }) {
  const { back, canGoBack, navigate } = useRouter()
  const recipe = useResource(() => fetchRecipe(recipeId), [recipeId])

  const [tab, setTab] = useState<Tab>('prep')

  // Tick and step state are intentionally local and ephemeral: they belong to
  // this cook, not to the recipe, and should reset when the screen is left.
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [currentStep, setCurrentStep] = useState<number | null>(null)

  function toggleIngredient(id: string, isChecked: boolean) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (isChecked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <AsyncScreen
      resource={recipe}
      loadingLabel="Fetching recipe"
      errorLabel="That recipe would not load"
      skeleton={<RecipeSkeleton />}
    >
      {(data) => (
        <Stack gap="lg" className="h-full">
          <Row gap="md">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              // Return to wherever this recipe was opened from; fall back to the
              // collection when there is no history (e.g. an HA-pushed recipe).
              onClick={() => (canGoBack ? back() : navigate({ name: 'collection' }))}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <Heading role="display" level={1} className="min-w-0 flex-1 truncate">
              {data.title}
            </Heading>
          </Row>

          <Row gap="sm" className="flex-wrap">
            {data.timeMinutes ? (
              <Badge tone="ember">
                <Clock className="mr-2 h-4 w-4" />
                {formatMinutes(data.timeMinutes)}
              </Badge>
            ) : null}
            {data.servings ? (
              <Badge>
                <UsersRound className="mr-2 h-4 w-4" />
                Serves {data.servings}
              </Badge>
            ) : null}
            {data.cuisine ? <Badge>{data.cuisine}</Badge> : null}
          </Row>

          <Tabs tab={tab} onChange={setTab} />

          {tab === 'prep' ? (
            <PrepPanel
              recipe={data}
              checked={checked}
              onToggle={toggleIngredient}
            />
          ) : (
            <CookPanel
              steps={data.cookSteps}
              currentStep={currentStep}
              onSetStep={setCurrentStep}
            />
          )}
        </Stack>
      )}
    </AsyncScreen>
  )
}

/** Segmented Prep/Cook switch, built from the button kit rather than a new
 *  domain component. */
function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <Row gap="sm" role="tablist" aria-label="Recipe stage" className="shrink-0">
      {(['prep', 'cook'] as const).map((value) => (
        <Button
          key={value}
          role="tab"
          aria-selected={tab === value}
          variant={tab === value ? 'secondary' : 'ghost'}
          size="md"
          onClick={() => onChange(value)}
          className="capitalize"
        >
          {value}
        </Button>
      ))}
    </Row>
  )
}

/** Prep tab: ingredients pinned beside the mise-en-place steps. */
function PrepPanel({
  recipe,
  checked,
  onToggle,
}: {
  recipe: Recipe
  checked: ReadonlySet<string>
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-5 gap-8">
      <Stack gap="md" className="col-span-2 min-h-0">
        {recipe.imageUrl ? <Image src={recipe.imageUrl} alt="" ratio="wide" /> : null}

        <Card className="flex min-h-0 flex-1 flex-col" pad="md">
          <Row justify="between" className="mb-2">
            <Heading role="section">Ingredients</Heading>
            <Text size="xs" tone="faint">
              {checked.size}/{recipe.ingredients.length}
            </Text>
          </Row>

          <Checklist className="-mx-2 min-h-0 flex-1 overflow-y-auto">
            {groupIngredients(recipe.ingredients).map((group, groupIndex) => (
              <div key={group.name ?? `g${groupIndex}`} className="contents">
                {group.name ? (
                  <Text
                    size="xs"
                    tone="faint"
                    className={`px-2 pb-1 uppercase tracking-wide ${groupIndex === 0 ? 'pt-1' : 'pt-3'}`}
                  >
                    {group.name}
                  </Text>
                ) : null}
                {group.items.map((ingredient) => (
                  <ChecklistItem
                    key={ingredient.id}
                    checked={checked.has(ingredient.id)}
                    onCheckedChange={(value) => onToggle(ingredient.id, value)}
                    trail={ingredient.amount}
                  >
                    {ingredient.text}
                  </ChecklistItem>
                ))}
              </div>
            ))}
          </Checklist>
        </Card>
      </Stack>

      <Card className="col-span-3 min-h-0 overflow-y-auto" pad="lg">
        <Heading role="section" className="mb-6">
          Preparation
        </Heading>
        {recipe.prepSteps.length > 0 ? (
          <Steps>
            {recipe.prepSteps.map((step, index) => (
              <Step key={step} index={index + 1}>
                {step}
              </Step>
            ))}
          </Steps>
        ) : (
          <Text tone="faint">Nothing to prep — straight to the pan.</Text>
        )}

        {recipe.notes.length > 0 ? (
          <>
            <Heading role="section" className="mb-3 mt-8">
              Notes
            </Heading>
            <Stack gap="sm">
              {recipe.notes.map((note, index) => (
                <Text key={index} tone="dim" className="leading-relaxed">
                  {note}
                </Text>
              ))}
            </Stack>
          </>
        ) : null}
      </Card>
    </div>
  )
}

/**
 * Collapse the flat ingredient list into ordered groups by their `group`
 * heading — consecutive items sharing a heading fall under it, and leading
 * ungrouped items keep an unnamed group so they render first without a header.
 */
function groupIngredients(
  ingredients: readonly Ingredient[],
): { name?: string; items: Ingredient[] }[] {
  const groups: { name?: string; items: Ingredient[] }[] = []
  for (const ingredient of ingredients) {
    const last = groups.at(-1)
    if (last && last.name === ingredient.group) last.items.push(ingredient)
    else groups.push({ name: ingredient.group, items: [ingredient] })
  }
  return groups
}

/** Cook tab: the method, walked one step at a time. */
function CookPanel({
  steps,
  currentStep,
  onSetStep,
}: {
  steps: readonly string[]
  currentStep: number | null
  onSetStep: (step: number | null) => void
}) {
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto" pad="lg">
      <Row justify="between" className="mb-6">
        <Heading role="section">Method</Heading>
        <Button
          size="lg"
          onClick={() => onSetStep(currentStep === null ? 0 : null)}
        >
          <CookingPot className="h-6 w-6" />
          {currentStep === null ? 'Start cooking' : 'Stop'}
        </Button>
      </Row>

      <Steps>
        {steps.map((step, index) => (
          <Step
            key={step}
            index={index + 1}
            active={currentStep === index}
            done={currentStep !== null && index < currentStep}
            onClick={() => onSetStep(index)}
            className="cursor-pointer"
          >
            {step}
          </Step>
        ))}
      </Steps>

      {currentStep !== null ? (
        <Row gap="md" className="mt-8">
          <Button
            variant="secondary"
            size="lg"
            disabled={currentStep === 0}
            onClick={() => onSetStep(Math.max(0, currentStep - 1))}
          >
            Previous
          </Button>
          <Spacer />
          <Button
            size="lg"
            disabled={currentStep >= steps.length - 1}
            onClick={() => onSetStep(Math.min(steps.length - 1, currentStep + 1))}
          >
            Next step
          </Button>
        </Row>
      ) : null}
    </Card>
  )
}

/** Loading placeholder — pinned ingredients column beside the scrolling method,
 *  matching the loaded 2/5–3/5 Prep split so nothing shifts on arrival. */
function RecipeSkeleton() {
  return (
    <Stack gap="lg" className="h-full">
      <Row gap="md">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-9 w-96" />
      </Row>

      <Row gap="sm">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </Row>

      <Row gap="sm">
        <Skeleton className="h-12 w-24 rounded-control" />
        <Skeleton className="h-12 w-24 rounded-control" />
      </Row>

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-8">
        <Stack gap="md" className="col-span-2 min-h-0">
          <Skeleton className="aspect-[3/2] w-full rounded-card" />
          <Card className="flex min-h-0 flex-1 flex-col" pad="md">
            <Row justify="between" className="mb-2">
              <Heading role="section" className="w-32">
                <SkeletonLine />
              </Heading>
              <Text size="xs" tone="faint" className="w-10">
                <SkeletonLine />
              </Text>
            </Row>
            <Stack gap="none">
              {Array.from({ length: 5 }, (_, i) => (
                <Row key={i} gap="md" className="min-h-touch">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                  <Skeleton className="h-4 flex-1" style={{ maxWidth: `${80 - i * 8}%` }} />
                </Row>
              ))}
            </Stack>
          </Card>
        </Stack>

        <Card className="col-span-3 min-h-0" pad="lg">
          <Heading role="section" className="mb-6 w-28">
            <SkeletonLine />
          </Heading>
          <Stack gap="lg">
            {Array.from({ length: 5 }, (_, i) => (
              <Row key={i} gap="md" align="start">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <SkeletonText lines={2} width="66%" className="flex-1 pt-1" />
              </Row>
            ))}
          </Stack>
        </Card>
      </div>
    </Stack>
  )
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`
}
