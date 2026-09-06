import { CalendarDays, ListChecks, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Card,
  Checklist,
  ChecklistItem,
  Grid,
  Heading,
  List,
  ListItem,
  Row,
  Skeleton,
  SkeletonLine,
  Stack,
  Text,
} from '@/components/ui'
import { fetchBriefing } from '@/lib/data'
import { useResource } from '@/lib/useResource'

/**
 * Morning briefing: weather, what's on, what's outstanding.
 * Composed by the backend — the hub only lays it out.
 */
export function Today() {
  const { navigate } = useRouter()
  const briefing = useResource(() => fetchBriefing(), [])

  // Optimistic local ticks. Phase 4 will POST these back to the HA todo list;
  // until then the interaction is real but the write is not.
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({})

  return (
    <AsyncScreen
      resource={briefing}
      loadingLabel="Composing your briefing"
      errorLabel="The briefing would not load"
      skeleton={<TodaySkeleton />}
    >
      {({ dateLabel, weather, events, tasks, meals }) => (
        <Stack gap="lg" className="h-full">
      <Row justify="between" align="end">
        <Heading role="hero" level={1}>
          {dateLabel}
        </Heading>
        {weather ? (
          <Row gap="md" align="center">
            <Heading as="span" role="hero" tone="ember">
              {Math.round(weather.temperature)}°C
            </Heading>
            <Stack gap="none">
              <Text size="sm">{weather.condition}</Text>
              {weather.high !== undefined && weather.low !== undefined ? (
                <Text size="xs" tone="faint">
                  {Math.round(weather.high)}° / {Math.round(weather.low)}°
                </Text>
              ) : null}
            </Stack>
          </Row>
        ) : null}
      </Row>

      {/* Events get a full-height column of their own: it is the longest list and
          the only one that runs to the bottom of the screen. The menu and tasks
          share the right column at a fixed 2:3 so both keep their own scroll
          rather than one starving the other on a busy day. */}
      <Grid cols={2} gap="lg" className="min-h-0 flex-1">
        <Card className="flex min-h-0 flex-col" pad="lg">
          <Row gap="sm" className="mb-3">
            <CalendarDays className="h-5 w-5 text-ember" />
            <Heading role="section">On today</Heading>
          </Row>

          {events.length === 0 ? (
            <Text tone="faint">Nothing scheduled.</Text>
          ) : (
            <List divided className="min-h-0 flex-1 overflow-y-auto">
              {events.map((event) => (
                <ListItem
                  key={event.id}
                  lead={
                    <span className="text-base font-medium tabular-nums text-ember">
                      {event.time}
                    </span>
                  }
                >
                  <Stack gap="none">
                    <Text size="sm">{event.title}</Text>
                    {event.location ? (
                      <Text size="xs" tone="faint">
                        {event.location}
                      </Text>
                    ) : null}
                  </Stack>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        <Stack gap="lg" className="min-h-0">
          <Card className="flex min-h-0 flex-[2] flex-col" pad="lg">
            <Row gap="sm" className="mb-3">
              <UtensilsCrossed className="h-5 w-5 text-clay" />
              <Heading role="section">On the menu</Heading>
            </Row>

            {meals.length === 0 ? (
              <Text tone="faint">Nothing planned.</Text>
            ) : (
              <Stack gap="sm" className="min-h-0 flex-1 overflow-y-auto">
                {meals.map((meal) => (
                  <Card
                    key={`${meal.slot}-${meal.recipeId}`}
                    as="button"
                    interactive
                    pad="sm"
                    // Sits on a card already, so it lifts to raised and darkens
                    // on press rather than using Card's default surface pairing.
                    className="flex shrink-0 flex-col items-start gap-1 bg-raised text-left active:bg-line"
                    onClick={() =>
                      navigate({ name: 'recipe', recipeId: meal.recipeId })
                    }
                  >
                    <Heading as="span" role="label" tone="faint">
                      {meal.slot}
                    </Heading>
                    <Text size="sm" className="font-medium leading-snug">
                      {meal.title}
                    </Text>
                  </Card>
                ))}
              </Stack>
            )}
          </Card>

          <Card className="flex min-h-0 flex-[3] flex-col" pad="lg">
            <Row gap="sm" className="mb-3">
              <ListChecks className="h-5 w-5 text-sage" />
              <Heading role="section">Outstanding</Heading>
            </Row>

            {tasks.length === 0 ? (
              <Text tone="faint">Nothing outstanding.</Text>
            ) : (
              <Checklist className="-mx-2 min-h-0 flex-1 overflow-y-auto">
                {tasks.map((task) => (
                  <ChecklistItem
                    key={task.id}
                    checked={doneOverride[task.id] ?? task.done}
                    onCheckedChange={(value) =>
                      setDoneOverride((prev) => ({ ...prev, [task.id]: value }))
                    }
                  >
                    {task.title}
                  </ChecklistItem>
                ))}
              </Checklist>
            )}
          </Card>
          </Stack>
        </Grid>
        </Stack>
      )}
    </AsyncScreen>
  )
}

/**
 * Loading placeholder. Built from the *same* layout and typography components as
 * the loaded briefing — Heading/Text/List/Card with the same classes — with only
 * the text swapped for line-height skeletons. That makes every box (header,
 * section rows, list rows) occupy the exact height it will once data arrives, so
 * the swap is a shimmer fading to content with zero reflow.
 */
function TodaySkeleton() {
  const taskWidths = ['w-1/2', 'w-2/3', 'w-2/5']

  return (
    <Stack gap="lg" className="h-full">
      <Row justify="between" align="end">
        <Heading role="hero" level={1} className="w-72">
          <SkeletonLine />
        </Heading>
        <Row gap="md" align="center">
          <Heading level={1} as="div" role="display" className="w-14">
            <SkeletonLine />
          </Heading>
          <Stack gap="none">
            <Text size="sm" className="w-28">
              <SkeletonLine />
            </Text>
            <Text size="xs" className="w-20">
              <SkeletonLine />
            </Text>
          </Stack>
        </Row>
      </Row>

      <Grid cols={2} gap="lg" className="min-h-0 flex-1">
        <Card className="flex min-h-0 flex-col" pad="lg">
          <CardHeadingSkeleton />
          <List divided className="min-h-0 flex-1">
            {[0, 1, 2].map((i) => (
              <ListItem key={i} lead={<Skeleton className="h-4 w-11 rounded" />}>
                <Stack gap="none">
                  <Text size="sm" className="w-3/4">
                    <SkeletonLine />
                  </Text>
                  <Text size="xs" className="w-1/3">
                    <SkeletonLine />
                  </Text>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Card>

        <Stack gap="lg" className="min-h-0">
          <Card className="flex min-h-0 flex-[2] flex-col" pad="lg">
            <CardHeadingSkeleton />
            <Stack gap="sm" className="min-h-0 flex-1">
              {[0, 1].map((i) => (
                <Card
                  key={i}
                  pad="sm"
                  className="flex shrink-0 flex-col items-start gap-1 bg-raised"
                >
                  <Heading as="div" role="label" className="w-16">
                    <SkeletonLine />
                  </Heading>
                  <Text size="sm" className="w-2/3">
                    <SkeletonLine />
                  </Text>
                </Card>
              ))}
            </Stack>
          </Card>

          <Card className="flex min-h-0 flex-[3] flex-col" pad="lg">
            <CardHeadingSkeleton />
            <Checklist className="-mx-2 min-h-0 flex-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex min-h-touch items-center gap-3 px-2 py-1.5"
                >
                  <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                  <span className="flex-1 text-base">
                    <SkeletonLine className={taskWidths[i]} />
                  </span>
                </div>
              ))}
            </Checklist>
          </Card>
        </Stack>
      </Grid>
    </Stack>
  )
}

/** The icon + title line every card on this screen opens with — same Row and
 *  Heading as the real cards, so its height matches to the pixel. */
function CardHeadingSkeleton() {
  return (
    <Row gap="sm" className="mb-3">
      <Skeleton className="h-5 w-5 rounded-md" />
      <Heading role="section" className="w-32">
        <SkeletonLine />
      </Heading>
    </Row>
  )
}
