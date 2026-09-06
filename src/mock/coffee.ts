import type {
  BeanCreateInput,
  BrewLogEntry,
  BrewLogInput,
  CoffeeBean,
  CoffeeBeanSummary,
} from '@/lib/contracts'

/**
 * Coffee fixtures. A small in-memory store rather than a frozen constant, so the
 * "Log a shot" form actually adds a row while running on mock data — the screen
 * behaves end-to-end before the Windmill/Notion scripts exist. Resets on reload,
 * which is fine for development.
 *
 * Shapes match the contracts exactly, so flipping `mockOverrides.coffee` off is
 * the only change needed to read from the real backend.
 */
const BEANS: Record<string, CoffeeBean> = {
  'BN-1': {
    id: 'BN-1',
    name: 'Ethiopia Guji Uraga',
    roaster: 'Half Light',
    origin: 'Ethiopia',
    region: 'Guji, Uraga',
    producer: 'Uraga washing station',
    process: 'Washed',
    varietal: 'Heirloom',
    altitude: '1950–2100 masl',
    roastLevel: 'Light',
    roastDateLabel: '2 Sep',
    purchaseDateLabel: '3 Sep',
    weightG: 250,
    price: 22,
    tastingNotes: 'Bergamot, jasmine, white peach',
    brewMethods: ['V60', 'Espresso'],
    targetRecipe: '2.5 · 18g in · 38g out · 28s',
    status: 'Open',
    rating: 4,
    brews: [
      {
        id: 'BR-1',
        dateLabel: '4 Sep',
        method: 'Espresso',
        grind: '2.7',
        doseG: 18,
        yieldG: 40,
        timeS: 24,
        waterTempC: 94,
        ratio: 2.2,
        result: 'Sour / Under',
        rating: 2,
        adjustment: 'Grind finer, aim for ~30s',
      },
      {
        id: 'BR-2',
        dateLabel: '5 Sep',
        method: 'Espresso',
        grind: '2.5',
        doseG: 18,
        yieldG: 38,
        timeS: 28,
        waterTempC: 94,
        ratio: 2.1,
        result: 'Balanced',
        rating: 4,
        adjustment: 'Keep. Maybe -0.5g dose to open florals.',
      },
    ],
  },
  'BN-2': {
    id: 'BN-2',
    name: 'Colombia El Placer',
    roaster: 'Cartel',
    origin: 'Colombia',
    region: 'Huila',
    producer: 'Nestor Lasso',
    process: 'Natural',
    varietal: 'Pink Bourbon',
    altitude: '1750 masl',
    roastLevel: 'Medium-Light',
    roastDateLabel: '29 Aug',
    weightG: 250,
    price: 20,
    tastingNotes: 'Strawberry, cacao, red apple',
    brewMethods: ['Espresso'],
    targetRecipe: '3.0 · 18g in · 36g out · 30s',
    status: 'Open',
    rating: 5,
    brews: [],
  },
}

/** Cheap incrementing suffix for new mock ids. */
let nextBean = Object.keys(BEANS).length + 1
let nextBrew = 100

export function mockBeanList(): CoffeeBean[] {
  return Object.values(BEANS)
}

export function mockBean(id: string): CoffeeBean | undefined {
  return BEANS[id]
}

/** Append a brew to a bean's log and return the created entry. */
export function mockLogBrew(input: BrewLogInput): BrewLogEntry {
  const bean = BEANS[input.beanId]
  if (!bean) throw new Error(`No mock bean "${input.beanId}"`)

  const ratio =
    input.doseG && input.yieldG && input.doseG > 0
      ? Math.round((input.yieldG / input.doseG) * 10) / 10
      : undefined

  const entry: BrewLogEntry = {
    id: `BR-${nextBrew++}`,
    dateLabel: 'Just now',
    method: input.method,
    grind: input.grind,
    doseG: input.doseG,
    yieldG: input.yieldG,
    timeS: input.timeS,
    waterTempC: input.waterTempC,
    ratio,
    result: input.result,
    rating: input.rating,
    adjustment: input.adjustment,
    notes: input.notes,
  }
  // Newest first, matching how the detail screen renders the log.
  bean.brews = [entry, ...bean.brews]
  return entry
}

/** Reserve the next bean id, so a create form can preview its printable code. */
export function mockNextBeanId(): string {
  return `BN-${nextBean}`
}

/** Turn an ISO date (yyyy-mm-dd) into the short label the backend would format. */
function label(iso?: string): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? undefined
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Catalog a new bean in the in-memory store and return its summary. */
export function mockCreateBean(input: BeanCreateInput): CoffeeBeanSummary {
  const id = `BN-${nextBean++}`
  const bean: CoffeeBean = {
    id,
    name: input.name,
    roaster: input.roaster,
    origin: input.origin,
    region: input.region,
    producer: input.producer,
    process: input.process,
    varietal: input.varietal,
    altitude: input.altitude,
    roastLevel: input.roastLevel,
    roastDateLabel: label(input.roastDate),
    purchaseDateLabel: label(input.purchaseDate),
    weightG: input.weightG,
    price: input.price,
    tastingNotes: input.tastingNotes,
    targetRecipe: input.targetRecipe,
    brewMethods: input.brewMethods,
    status: input.status,
    rating: input.rating,
    brews: [],
  }
  BEANS[id] = bean
  const { name, roaster, origin, roastLevel, roastDateLabel, status, rating } = bean
  return { id, name, roaster, origin, roastLevel, roastDateLabel, status, rating }
}
