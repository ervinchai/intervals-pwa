import { AnimatePresence, motion } from 'motion/react'
import { Flame, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button, Heading, Stack, Text } from '@/components/ui'
import type { Resource } from '@/lib/useResource'

/**
 * Wraps a resource-backed screen so the placeholder and the loaded content
 * cross-fade instead of hard-swapping: the skeleton (or error) fades out and the
 * real content fades in, keyed on whether data is ready. Content only renders
 * once ready, so the render function always gets non-null data.
 *
 *   <AsyncScreen resource={r} loadingLabel="…" errorLabel="…" skeleton={<S />}>
 *     {(data) => <RealScreen {...data} />}
 *   </AsyncScreen>
 */
export function AsyncScreen<T>({
  resource,
  loadingLabel,
  errorLabel,
  skeleton,
  children,
}: {
  resource: Resource<T> & { reload: () => void }
  loadingLabel: string
  errorLabel: string
  skeleton?: ReactNode
  children: (data: T) => ReactNode
}) {
  const ready = resource.status === 'ready'

  // A true cross-dissolve: the two phases are stacked (absolute inset-0) and
  // animate at the same time — the skeleton fades out *while* the content fades
  // in. Sequential mode ("wait") would blank the whole panel to nothing between
  // the two, which reads as a jarring flash.
  return (
    <div className="relative h-full">
      <AnimatePresence initial={false}>
        <motion.div
          key={ready ? 'content' : 'placeholder'}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {ready ? (
            children(resource.data)
          ) : (
            <ScreenState
              resource={resource}
              loadingLabel={loadingLabel}
              errorLabel={errorLabel}
              skeleton={skeleton}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * Loading and failure states, shared by every screen.
 *
 * The hub is often unattended, so a failure has to explain itself legibly from
 * across the room and offer a one-tap retry — never a blank panel.
 *
 * Loading prefers a screen-shaped `skeleton`: same boxes in the same places as
 * the loaded view, so arrival is a shimmer-to-content swap with no layout jump.
 * The flame remains as a fallback for screens that haven't supplied one.
 */
export function ScreenState<T>({
  resource,
  loadingLabel,
  errorLabel,
  skeleton,
}: {
  resource: Resource<T> & { reload: () => void }
  loadingLabel: string
  errorLabel: string
  /** Screen-shaped placeholder for the loading state. */
  skeleton?: ReactNode
}) {
  if (resource.status === 'loading') {
    if (skeleton) {
      // The blocks are aria-hidden; this region carries the announcement so a
      // screen reader hears "loading" instead of nothing.
      return (
        <div role="status" aria-busy="true" aria-label={`${loadingLabel}…`} className="h-full">
          {skeleton}
        </div>
      )
    }
    return (
      <Stack gap="md" align="center" justify="center" className="h-full">
        <Flame className="h-12 w-12 animate-pulse text-ember" />
        <Text tone="dim">{loadingLabel}…</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="lg" align="center" justify="center" className="h-full">
      <TriangleAlert className="h-12 w-12 text-clay" />
      <Stack gap="sm" align="center">
        <Heading role="title">{errorLabel}</Heading>
        <Text tone="faint" size="sm" className="max-w-lg text-center">
          {resource.error?.message}
        </Text>
      </Stack>
      <Button variant="secondary" size="lg" onClick={resource.reload}>
        Try again
      </Button>
    </Stack>
  )
}
