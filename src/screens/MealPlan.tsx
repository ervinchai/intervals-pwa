import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Card,
  Grid,
  Heading,
  Image,
  Row,
  Skeleton,
  SkeletonLine,
  Stack,
  Text,
} from '@/components/ui'
import type { MealPlanDay } from '@/lib/contracts'
import { fetchMealPlan } from '@/lib/data'
import { useResource } from '@/lib/useResource'

/**
 * The week at a glance, split into the working week and the weekend.
 *
 * Seven columns across left each day only ~145px on the iPad's landscape dock.
 * Five plus two gives the weekdays real width and lets the weekend read as its
 * own block, which is also how the cooking tends to divide.
 */
export function MealPlan() {
  const { navigate } = useRouter()
  const plan = useResource(() => fetchMealPlan(), [])

  function pick(recipeId: string) {
    navigate({ name: 'recipe', recipeId })
  }

  return (
    <AsyncScreen
      resource={plan}
      loadingLabel="Loading the week"
      errorLabel="The meal plan would not load"
      skeleton={<MealPlanSkeleton />}
    >
      {(data) => {
        const today = new Date().toISOString().slice(0, 10)
        const { weekdays, weekend } = splitWeekend(data.days)

        return (
          <Stack gap="lg" className="h-full">
      <Row>
        <Heading role="hero" level={1}>
          This week
        </Heading>
      </Row>

      <Stack gap="lg" className="min-h-0 flex-1">
        {weekdays.length > 0 ? (
          <Stack gap="sm" className="min-h-0 flex-[3]">
            <Heading as="span" role="label" tone="faint">
              Weekdays
            </Heading>
            <Grid cols={5} gap="md" className="min-h-0 flex-1">
              {weekdays.map((day) => (
                <DayColumn
                  key={day.date}
                  day={day}
                  isToday={day.date === today}
                  onPick={pick}
                />
              ))}
            </Grid>
          </Stack>
        ) : null}

        {weekend.length > 0 ? (
          <Stack gap="sm" className="min-h-0 flex-[2]">
            <Heading as="span" role="label" tone="faint">
              Weekend
            </Heading>
            <Grid cols={2} gap="md" className="min-h-0 flex-1">
              {weekend.map((day) => (
                <DayColumn
                  key={day.date}
                  day={day}
                  isToday={day.date === today}
                  onPick={pick}
                  // Weekend cards are ~2.5x wider, so a square crop would
                  // dominate them once real imagery arrives.
                  imageRatio="wide"
                />
              ))}
            </Grid>
          </Stack>
        ) : null}
          </Stack>
        </Stack>
        )
      }}
    </AsyncScreen>
  )
}

function DayColumn({
  day,
  isToday,
  onPick,
  imageRatio = 'square',
}: {
  day: MealPlanDay
  isToday: boolean
  onPick: (recipeId: string) => void
  imageRatio?: 'square' | 'wide'
}) {
  return (
    <Stack gap="sm" className="min-h-0">
      {/* Ember on the label is enough to mark today — a badge alongside it
          crowds the column. */}
      <Row gap="sm" align="center">
        <Heading as="span" role="label" tone={isToday ? 'ember' : 'faint'}>
          {weekdayOf(day.date)}
        </Heading>
        {isToday ? (
          <span className="h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
        ) : null}
      </Row>

      {day.meals.length === 0 ? (
        <Card
          pad="sm"
          className="flex flex-1 items-center justify-center border-dashed"
        >
          <Text size="xs" tone="faint">
            Nothing planned
          </Text>
        </Card>
      ) : (
        day.meals.map((meal) => (
          <Card
            key={`${meal.slot}-${meal.recipeId}`}
            as="button"
            interactive
            pad="sm"
            className="flex flex-1 flex-col gap-3"
            onClick={() => onPick(meal.recipeId)}
          >
            {meal.imageUrl ? (
              <Image src={meal.imageUrl} alt="" ratio={imageRatio} />
            ) : null}
            <Heading as="span" role="label" tone="faint">
              {meal.slot}
            </Heading>
            <Text size="sm" className="font-medium leading-snug">
              {meal.title}
            </Text>
          </Card>
        ))
      )}
    </Stack>
  )
}

/**
 * Loading placeholder. Same Heading/Grid/Card components and classes as the
 * loaded week — the 5-column weekday band over a 2-column weekend band — so the
 * title, the row labels, and every day column keep their exact height and the
 * days don't jump when they arrive.
 */
function MealPlanSkeleton() {
  return (
    <Stack gap="lg" className="h-full">
      <Row>
        <Heading role="hero" level={1} className="w-64">
          <SkeletonLine />
        </Heading>
      </Row>

      <Stack gap="lg" className="min-h-0 flex-1">
        <Stack gap="sm" className="min-h-0 flex-[3]">
          <Heading as="div" role="label" className="w-24">
            <SkeletonLine />
          </Heading>
          <Grid cols={5} gap="md" className="min-h-0 flex-1">
            {Array.from({ length: 5 }, (_, i) => (
              <DayColumnSkeleton key={i} />
            ))}
          </Grid>
        </Stack>

        <Stack gap="sm" className="min-h-0 flex-[2]">
          <Heading as="div" role="label" className="w-24">
            <SkeletonLine />
          </Heading>
          <Grid cols={2} gap="md" className="min-h-0 flex-1">
            {Array.from({ length: 2 }, (_, i) => (
              <DayColumnSkeleton key={i} wide />
            ))}
          </Grid>
        </Stack>
      </Stack>
    </Stack>
  )
}

function DayColumnSkeleton({ wide }: { wide?: boolean }) {
  return (
    <Stack gap="sm" className="min-h-0">
      <Row gap="sm" align="center">
        <Heading as="div" role="label" className="w-12">
          <SkeletonLine />
        </Heading>
      </Row>
      <Card pad="sm" className="flex flex-1 flex-col gap-3">
        <Skeleton
          className={wide ? 'aspect-[3/2] w-full rounded-card' : 'aspect-square w-full rounded-card'}
        />
        <Heading as="div" role="label" className="w-16">
          <SkeletonLine />
        </Heading>
        <Text size="sm" className="w-full">
          <SkeletonLine />
        </Text>
      </Card>
    </Stack>
  )
}

/**
 * Partitions on the actual day of the week rather than on position, so a plan
 * that does not start on a Monday — or does not span exactly seven days — still
 * lands in the right block.
 */
function splitWeekend(days: readonly MealPlanDay[]) {
  const weekdays: MealPlanDay[] = []
  const weekend: MealPlanDay[] = []

  for (const day of days) {
    const parsed = new Date(`${day.date}T00:00:00`)
    const isWeekend =
      !Number.isNaN(parsed.getTime()) &&
      (parsed.getDay() === 0 || parsed.getDay() === 6)

    // An unparseable date stays in the weekday block rather than vanishing.
    if (isWeekend) weekend.push(day)
    else weekdays.push(day)
  }

  return { weekdays, weekend }
}

/** Short weekday label from an ISO date, without pulling in a date library. */
function weekdayOf(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString(undefined, { weekday: 'short' })
}
