import { Coffee, Star } from 'lucide-react'

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
  Text,
} from '@/components/ui'
import type { CoffeeBeanSummary } from '@/lib/contracts'
import { fetchCoffeeCollection } from '@/lib/data'
import { useResource } from '@/lib/useResource'

/**
 * The coffee-bean catalog — every bag as a tappable card. Selecting one opens
 * the same `BeanView` the QR scanner routes to, so a scanned jar and a tapped
 * card land on one screen.
 */
export function Beans() {
  const { navigate } = useRouter()
  const collection = useResource(() => fetchCoffeeCollection(), [])

  return (
    <AsyncScreen
      resource={collection}
      loadingLabel="Loading beans"
      errorLabel="The beans would not load"
      skeleton={<BeansSkeleton />}
    >
      {({ beans }) => (
        <Stack gap="lg" className="h-full">
          <Row>
            <Heading role="hero" level={1}>
              Coffee
            </Heading>
          </Row>

          {beans.length === 0 ? (
            <Text tone="faint">No beans catalogued yet.</Text>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Grid cols={3} gap="lg">
                {beans.map((bean) => (
                  <BeanCard
                    key={bean.id}
                    bean={bean}
                    onPick={() => navigate({ name: 'bean', beanId: bean.id })}
                  />
                ))}
              </Grid>
            </div>
          )}
        </Stack>
      )}
    </AsyncScreen>
  )
}

function BeanCard({
  bean,
  onPick,
}: {
  bean: CoffeeBeanSummary
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
      {bean.imageUrl ? (
        <Image src={bean.imageUrl} alt="" ratio="wide" />
      ) : (
        <div className="flex aspect-[3/2] w-full items-center justify-center rounded-card bg-raised">
          <Coffee className="h-8 w-8 text-ink-faint" />
        </div>
      )}

      <Stack gap="xs" className="min-w-0">
        <Heading role="section" className="min-w-0">
          {bean.name}
        </Heading>
        {bean.roaster ? (
          <Text size="sm" tone="dim">
            {bean.roaster}
          </Text>
        ) : null}
      </Stack>

      <Row gap="sm" className="flex-wrap">
        {bean.roastLevel ? <Badge tone="ember">{bean.roastLevel}</Badge> : null}
        {bean.origin ? <Badge>{bean.origin}</Badge> : null}
        {bean.rating ? (
          <Badge>
            <Star className="mr-1 h-3.5 w-3.5" />
            {bean.rating}
          </Badge>
        ) : null}
      </Row>

      {bean.roastDateLabel ? (
        <Text size="sm" tone="faint">
          Roasted {bean.roastDateLabel}
        </Text>
      ) : null}
    </Card>
  )
}

/** Loading placeholder matching the loaded 3-column grid. */
function BeansSkeleton() {
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
