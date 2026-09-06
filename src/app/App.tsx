import { AnimatePresence, motion } from 'motion/react'
import {
  BookOpen,
  CalendarRange,
  Coffee,
  Printer,
  QrCode,
  Settings as SettingsIcon,
  Sunrise,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { RouterProvider } from '@/app/RouterProvider'
import { useRouter, type Screen } from '@/app/router'
import { Button, Spacer } from '@/components/ui'
import { BeanView } from '@/screens/BeanView'
import { Beans } from '@/screens/Beans'
import { Collection } from '@/screens/Collection'
import { MealPlan } from '@/screens/MealPlan'
import { Print } from '@/screens/Print'
import { RecipeView } from '@/screens/RecipeView'
import { Scan } from '@/screens/Scan'
import { Settings } from '@/screens/Settings'
import { Today } from '@/screens/Today'
import type { Config } from '@/lib/config'

export function App({
  config,
  initialScreen,
}: {
  config: Config
  /** Screen resolved from a deep link (scanned QR / shared URL), if any. */
  initialScreen?: Screen
}) {
  return (
    <RouterProvider initial={initialScreen}>
      <Shell devBadge={config.useMockData} />
    </RouterProvider>
  )
}

/**
 * Root shell: a left nav rail beside the screen area.
 *
 * The rail is deliberately on the left, not the bottom. In landscape the only
 * safe-area inset that bites is the bottom home indicator; a side rail never
 * goes near it, so navigation lives entirely in the safe zone and we stop
 * fighting the OS chrome. The screen area still pads itself off the status bar
 * and indicator so its own content stays clear.
 */
function Shell({ devBadge }: { devBadge: boolean }) {
  const { screen } = useRouter()

  return (
    <div
      // h-dvh, not h-full: a percentage height doesn't reliably resolve against
      // the fixed #root in iOS standalone. The dynamic viewport unit pins the
      // shell to the real screen height.
      className="flex h-dvh w-full overflow-hidden bg-base pt-2 text-ink"
    >
      <NavRail devBadge={devBadge} />

      <main className="relative min-h-0 min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey(screen)}
            // Full-bleed to the screen edges — no safe-area insets. In landscape
            // the top/right/bottom chrome is thin and translucent, so the content
            // reads edge-to-edge and native. Just a clean design gutter.
            className="absolute inset-0 p-5"
            // A plain cross-fade — no translate. Simpler, and it doesn't drag
            // content sideways/up on a wall display where stillness reads calmer.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {renderScreen(screen)}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function renderScreen(screen: Screen): ReactNode {
  switch (screen.name) {
    case 'today':
      return <Today />
    case 'meal-plan':
      return <MealPlan />
    case 'collection':
      return <Collection />
    case 'recipe':
      return <RecipeView recipeId={screen.recipeId} />
    case 'beans':
      return <Beans />
    case 'bean':
      return <BeanView beanId={screen.beanId} />
    case 'settings':
      return <Settings />
    case 'scan':
      return <Scan />
    case 'print':
      return <Print />
  }
}

/** Distinct key per screen *instance*, so recipe→recipe and bean→bean animate. */
function screenKey(screen: Screen): string {
  if (screen.name === 'recipe') return `recipe:${screen.recipeId}`
  if (screen.name === 'bean') return `bean:${screen.beanId}`
  return screen.name
}

/**
 * Manual navigation. Home Assistant drives the hub most of the time, but a
 * human standing at the dock needs a way to move around too.
 *
 * An icon-only left rail with no surface of its own — it floats on the page
 * background so it reads as part of the canvas rather than a chrome bar, and
 * there is no footer edge to leave a gap. The active item earns its own pill;
 * everything else is transparent.
 */
function NavRail({ devBadge }: { devBadge: boolean }) {
  const { screen, navigate } = useRouter()

  return (
    <nav className="flex w-20 shrink-0 flex-col items-center gap-2 px-3 py-5">
      <Button
        size="icon"
        variant={screen.name === 'today' ? 'secondary' : 'ghost'}
        aria-label="Today"
        onClick={() => navigate({ name: 'today' })}
      >
        <Sunrise className="h-6 w-6" />
      </Button>
      <Button
        size="icon"
        variant={screen.name === 'meal-plan' ? 'secondary' : 'ghost'}
        aria-label="Meal plan"
        onClick={() => navigate({ name: 'meal-plan' })}
      >
        <CalendarRange className="h-6 w-6" />
      </Button>
      <Button
        size="icon"
        // A recipe is always reached through the collection, so the Recipes tab
        // stays lit while one is open — the detail has no tab of its own.
        variant={
          screen.name === 'collection' || screen.name === 'recipe'
            ? 'secondary'
            : 'ghost'
        }
        aria-label="Recipes"
        onClick={() => navigate({ name: 'collection' })}
      >
        <BookOpen className="h-6 w-6" />
      </Button>

      <Button
        size="icon"
        // A bean detail is reached through the catalog (or a scan), so the
        // Coffee tab stays lit while one is open — the detail has no tab.
        variant={
          screen.name === 'beans' || screen.name === 'bean'
            ? 'secondary'
            : 'ghost'
        }
        aria-label="Coffee"
        onClick={() => navigate({ name: 'beans' })}
      >
        <Coffee className="h-6 w-6" />
      </Button>

      <Button
        size="icon"
        variant={screen.name === 'scan' ? 'secondary' : 'ghost'}
        aria-label="Scan QR code"
        onClick={() => navigate({ name: 'scan' })}
      >
        <QrCode className="h-6 w-6" />
      </Button>

      <Button
        size="icon"
        variant={screen.name === 'print' ? 'secondary' : 'ghost'}
        aria-label="Print QR label"
        onClick={() => navigate({ name: 'print' })}
      >
        <Printer className="h-6 w-6" />
      </Button>

      <Spacer />

      <Button
        size="icon"
        variant={screen.name === 'settings' ? 'secondary' : 'ghost'}
        aria-label="Settings"
        onClick={() => navigate({ name: 'settings' })}
      >
        <SettingsIcon className="h-6 w-6" />
      </Button>

      {devBadge ? (
        <span className="text-center text-[0.65rem] leading-tight text-ink-faint">
          mock
        </span>
      ) : null}
    </nav>
  )
}
