import { Plus } from 'lucide-react'

import { useRouter } from '@/app/router'
import { AsyncScreen } from '@/components/ScreenState'
import {
  Button,
  Card,
  Heading,
  Row,
  SkeletonLine,
  Spacer,
  Stack,
  Text,
} from '@/components/ui'
import type { CoffeeBeanSummary } from '@/lib/contracts'
import { fetchCoffeeCollection } from '@/lib/data'
import { daysOffRoast, freshness, parseTarget } from '@/lib/coffee-utils'
import { useResource } from '@/lib/useResource'

/**
 * The coffee-bean catalog — every bag as an aligned row.
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
      {({ beans }) => {
        const open = beans.filter((b) => b.status === 'Open')
        const rest = beans.filter((b) => b.status !== 'Open')

        return (
          <Stack gap="lg" className="h-full">
            <Row>
              <Heading role="hero" level={1}>
                Coffee
              </Heading>
              <Spacer />
              <Text size="sm" tone="faint">
                {beans.length} bags · {open.length} open
              </Text>
              <Button
                size="icon"
                aria-label="New bean"
                onClick={() => navigate({ name: 'new-bean' })}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </Row>

            {beans.length === 0 ? (
              <Stack gap="md" align="start">
                <Text tone="faint">No beans catalogued yet.</Text>
                <Button variant="primary" onClick={() => navigate({ name: 'new-bean' })}>
                  Add a bean
                </Button>
              </Stack>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Stack gap="lg">
                  {open.length > 0 ? (
                    <Stack gap="sm">
                      <Row gap="sm" className="px-[14px]">
                        <Heading role="label" as="span" tone="faint">
                          Open
                        </Heading>
                        <div className="h-px flex-1 bg-line" />
                      </Row>
                      <Stack gap="sm">
                        {open.map((b) => (
                          <BeanRow
                            key={b.id}
                            bean={b}
                            onPick={() => navigate({ name: 'bean', beanId: b.id })}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  ) : null}

                  {rest.length > 0 ? (
                    <Stack gap="sm">
                      <Row gap="sm" className="px-[14px]">
                        <Heading role="label" as="span" tone="faint">
                          Finished
                        </Heading>
                        <div className="h-px flex-1 bg-line" />
                      </Row>
                      <Stack gap="sm">
                        {rest.map((b) => (
                          <BeanRow
                            key={b.id}
                            bean={b}
                            onPick={() => navigate({ name: 'bean', beanId: b.id })}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  ) : null}
                </Stack>
              </div>
            )}
          </Stack>
        )
      }}
    </AsyncScreen>
  )
}

function BeanRow({
  bean,
  onPick,
}: {
  bean: CoffeeBeanSummary
  onPick: () => void
}) {
  const days = daysOffRoast(bean.roastDateLabel)
  const fresh = freshness(days)
  const target = parseTarget(bean.targetRecipe)

  return (
    <Card
      as="button"
      interactive
      pad="none"
      onClick={onPick}
      className="block w-full px-[14px] py-3"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_132px_150px] items-center gap-4">
        <Stack gap="none" className="min-w-0">
          <Heading
            role="section"
            className="overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {bean.name}
          </Heading>
          <Text
            size="sm"
            tone="dim"
            className="overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {bean.roaster} · {bean.origin} · {bean.process}
          </Text>
        </Stack>

        <Stack gap="none">
          <Text
            size="sm"
            tone={
              fresh.tone === 'sage'
                ? 'sage'
                : fresh.tone === 'clay'
                  ? 'default'
                  : 'dim'
            }
            className="tabular-nums"
            style={
              fresh.tone === 'clay' ? { color: 'var(--color-clay)' } : undefined
            }
          >
            {fresh.text}
          </Text>
          <Text size="xs" tone="faint">
            {bean.roastLevel} · {bean.weightG} g
          </Text>
        </Stack>

        {target ? (
          <Stack gap="none" align="end">
            <Text size="sm" tone="ember" className="tabular-nums">
              {target.grind} · {target.dose} · {target.yield}
            </Text>
            <Text size="xs" tone="faint">
              dialled in · {target.time}
            </Text>
          </Stack>
        ) : (
          <Text size="sm" tone="faint" className="text-right">
            not dialled in
          </Text>
        )}
      </div>
    </Card>
  )
}

function BeansSkeleton() {
  return (
    <Stack gap="lg" className="h-full">
      <Row>
        <Heading role="hero" level={1} className="w-56">
          <SkeletonLine />
        </Heading>
      </Row>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Stack gap="lg">
          <Stack gap="sm">
            <Row gap="sm" className="px-[14px]">
              <Heading role="label" as="span" tone="faint">
                Open
              </Heading>
              <div className="h-px flex-1 bg-line" />
            </Row>
            <Stack gap="sm">
              {Array.from({ length: 3 }, (_, i) => (
                <Card key={i} pad="none" className="block w-full px-[14px] py-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_132px_150px] items-center gap-4">
                    <Stack gap="xs">
                      <SkeletonLine className="h-5 w-40" />
                      <SkeletonLine className="h-4 w-32" />
                    </Stack>
                  </div>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </div>
    </Stack>
  )
}
