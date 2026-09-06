import { Clock, CookingPot } from 'lucide-react'

import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Badge,
  Card,
  Grid,
  Heading,
  Image,
  Row,
  Skeleton,
  SkeletonLine,
  Stack,
} from '@/components/ui'
import type { RecipeSummary } from '@/lib/contracts'
import { fetchRecipeCollection } from '@/lib/data'
import { useResource } from '@/lib/useResource'

/**
 * The recipe collection — every recipe as a tappable card. Selecting one opens
 * the same `RecipeView` the meal plan and Today briefing route to, so there is a
 * single recipe screen no matter where you came from.
 */
export function Collection() {
  const { navigate } = useRouter()
  const collection = useResource(() => fetchRecipeCollection(), [])

  return (
    <AsyncScreen
      resource={collection}
      loadingLabel="Loading recipes"
      errorLabel="The recipes would not load"
      skeleton={<CollectionSkeleton />}
    >
      {({ recipes }) => (
        <Stack gap="lg" className="h-full">
          <Row>
            <Heading role="hero" level={1}>
              Recipes
            </Heading>
          </Row>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Grid cols={3} gap="lg">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onPick={() => navigate({ name: 'recipe', recipeId: recipe.id })}
                />
              ))}
            </Grid>
          </div>
        </Stack>
      )}
    </AsyncScreen>
  )
}

function RecipeCard({
  recipe,
  onPick,
}: {
  recipe: RecipeSummary
  onPick: () => void
}) {
  return (
    <Card
      as="button"
      interactive
      pad="sm"
      className="flex flex-col gap-3"
      onClick={onPick}
    >
      {recipe.imageUrl ? (
        <Image src={recipe.imageUrl} alt="" ratio="wide" />
      ) : (
        <div className="flex aspect-[3/2] w-full items-center justify-center rounded-card bg-raised">
          <CookingPot className="h-8 w-8 text-ink-faint" />
        </div>
      )}

      <Heading role="section" className="min-w-0">
        {recipe.title}
      </Heading>

      <Row gap="sm" className="flex-wrap">
        {recipe.timeMinutes ? (
          <Badge tone="ember">
            <Clock className="mr-2 h-4 w-4" />
            {formatMinutes(recipe.timeMinutes)}
          </Badge>
        ) : null}
        {recipe.cuisine ? <Badge>{recipe.cuisine}</Badge> : null}
      </Row>
    </Card>
  )
}

/** Loading placeholder — a 3-column grid of card-shaped blocks, matching the
 *  loaded layout so nothing shifts on arrival. */
function CollectionSkeleton() {
  return (
    <Stack gap="lg" className="h-full">
      <Row>
        <Heading role="hero" level={1} className="w-56">
          <SkeletonLine />
        </Heading>
      </Row>

      <Grid cols={3} gap="lg" className="min-h-0">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} pad="sm" className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/2] w-full rounded-card" />
            <Heading role="section" className="w-3/4">
              <SkeletonLine />
            </Heading>
            <Row gap="sm">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </Row>
          </Card>
        ))}
      </Grid>
    </Stack>
  )
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`
}
