import type { Briefing, MealPlan, Recipe } from '@/lib/contracts'

/**
 * Development fixtures. Shapes match the contracts in @/lib/contracts exactly, so swapping
 * `useMockData` off is the only change needed to go live.
 *
 * Images are omitted deliberately — the kit renders its placeholder surface,
 * which is what a cold cache looks like on the real device anyway.
 */

export const MOCK_RECIPES: Record<string, Recipe> = {
  'ragu-bianco': {
    id: 'ragu-bianco',
    title: 'Pork Ragù Bianco',
    timeMinutes: 150,
    servings: 4,
    cuisine: 'Italian',
    ingredients: [
      { id: 'i1', text: 'Pork shoulder, diced', amount: '900 g' },
      { id: 'i2', text: 'Pancetta, chopped', amount: '120 g' },
      { id: 'i3', text: 'Yellow onion, fine dice', amount: '1 large' },
      { id: 'i4', text: 'Celery, fine dice', amount: '2 ribs' },
      { id: 'i5', text: 'Garlic, sliced', amount: '4 cloves' },
      { id: 'i6', text: 'Dry white wine', amount: '250 ml' },
      { id: 'i7', text: 'Whole milk', amount: '300 ml' },
      { id: 'i8', text: 'Rosemary and sage', amount: '2 sprigs' },
      { id: 'i9', text: 'Pappardelle', amount: '500 g' },
      { id: 'i10', text: 'Parmesan, grated', amount: 'to serve' },
    ],
    prepSteps: [
      'Dice the pork shoulder into 2cm cubes and chop the pancetta.',
      'Fine-dice the onion and celery, then slice the garlic.',
      'Measure out the wine and milk, and strip the rosemary and sage.',
    ],
    cookSteps: [
      'Render the pancetta in a heavy pot over medium heat until the fat runs and the edges crisp, about 8 minutes.',
      'Raise the heat and brown the pork in batches. Do not crowd the pot — you want colour, not steam. Set aside.',
      'Drop to medium-low. Sweat the onion, celery, and garlic in the rendered fat until soft and translucent, about 12 minutes.',
      'Return the pork. Pour in the wine and scrape the fond from the base. Simmer until nearly dry.',
      'Add the milk and herbs. Bring to a bare simmer, cover partially, and cook 2 hours until the pork collapses under a spoon.',
      'Shred the meat into the sauce. Season, and loosen with pasta water when you dress the pappardelle.',
      'Serve with grated parmesan and a hard crack of black pepper.',
    ],
    notes: [],
  },
  'charred-broccoli': {
    id: 'charred-broccoli',
    title: 'Charred Broccoli, Anchovy, Chilli',
    timeMinutes: 25,
    servings: 2,
    cuisine: 'Italian',
    ingredients: [
      { id: 'i1', text: 'Broccoli, in large florets', amount: '2 heads' },
      { id: 'i2', text: 'Anchovy fillets in oil', amount: '6' },
      { id: 'i3', text: 'Dried chilli flakes', amount: '1 tsp' },
      { id: 'i4', text: 'Garlic, thinly sliced', amount: '3 cloves' },
      { id: 'i5', text: 'Lemon', amount: '1' },
      { id: 'i6', text: 'Olive oil', amount: '3 tbsp' },
    ],
    prepSteps: [
      'Cut the broccoli into large florets, halving each through the stem.',
      'Thinly slice the garlic and drain the anchovy fillets.',
      'Zest and halve the lemon.',
    ],
    cookSteps: [
      'Get a dry heavy skillet properly hot — the pan should be smoking faintly.',
      'Add the broccoli cut-side down with a little oil. Leave it alone for 4 minutes to take on real char.',
      'Push to one side. Add the remaining oil, garlic, chilli, and anchovy, breaking the anchovy up as it melts.',
      'Toss everything together for a minute. Finish with lemon juice and zest off the heat.',
    ],
    notes: [],
  },
  'miso-cod': {
    id: 'miso-cod',
    title: 'Miso-Glazed Cod',
    timeMinutes: 30,
    servings: 2,
    cuisine: 'Japanese',
    ingredients: [
      { id: 'i1', text: 'Black cod fillets', amount: '2 × 180 g' },
      { id: 'i2', text: 'White miso', amount: '3 tbsp' },
      { id: 'i3', text: 'Mirin', amount: '2 tbsp' },
      { id: 'i4', text: 'Sake', amount: '2 tbsp' },
      { id: 'i5', text: 'Caster sugar', amount: '1 tbsp' },
      { id: 'i6', text: 'Spring onion, sliced', amount: '2' },
    ],
    prepSteps: [
      'Pat the cod fillets dry with kitchen paper.',
      'Slice the spring onion, and measure the miso, mirin, sake, and sugar.',
    ],
    cookSteps: [
      'Warm the mirin and sake to burn off the alcohol, then whisk in the miso and sugar until smooth. Cool completely.',
      'Coat the cod and marinate — 30 minutes at minimum, overnight is better.',
      'Wipe off the excess marinade or it will scorch before the fish is done.',
      'Grill close to a high heat for 6–8 minutes until blistered and just flaking.',
      'Scatter with spring onion and serve with plain rice.',
    ],
    notes: [],
  },
  'air-fryer-chicken': {
    id: 'air-fryer-chicken',
    title: 'Crispy Air Fryer Japanese Chicken Bites',
    timeMinutes: 35,
    servings: 3,
    cuisine: 'Japanese',
    // Exercises grouped ingredients: a leading ungrouped item, then two
    // named groups. Mirrors the Capacities authoring convention.
    ingredients: [
      { id: 'i1', text: 'Chicken thighs, cut into 1.5-inch bite-sized pieces', amount: '1.5 lbs' },
      { id: 'i2', text: 'Soy sauce', amount: '2 tbsp', group: 'Japanese Savory Marinade' },
      { id: 'i3', text: 'Mirin (or cooking sake)', amount: '1 tbsp', group: 'Japanese Savory Marinade' },
      { id: 'i4', text: 'Fresh ginger, finely grated', amount: '1 tsp', group: 'Japanese Savory Marinade' },
      { id: 'i5', text: 'Garlic, finely minced', amount: '2 cloves', group: 'Japanese Savory Marinade' },
      { id: 'i6', text: 'Sesame oil', amount: '1 tsp', group: 'Japanese Savory Marinade' },
      { id: 'i7', text: 'Beaten egg (binds the starch to the chicken)', amount: '1', group: 'Japanese Savory Marinade' },
      { id: 'i8', text: 'Cornstarch (or potato starch / katakuriko)', amount: '1/2 cup', group: 'Coating' },
      { id: 'i9', text: 'Cooking oil spray', group: 'Coating' },
    ],
    prepSteps: [
      'Cut chicken into 1.5-inch bite-sized pieces.',
      'Mix chicken with soy sauce, mirin, ginger, garlic, and sesame oil, then whisk in the beaten egg until well combined.',
      'Marinate for at least 15 minutes, up to 2 hours.',
      'Place cornstarch in a shallow bowl.',
      'Lift chicken from the marinade, letting excess drip slightly, then toss in cornstarch until coated in a thick, shaggy paste.',
      'Preheat air fryer to 400°F (200°C) and lightly spray the basket.',
    ],
    cookSteps: [
      'Arrange chicken bites in a single layer with space between them, then spray generously so no dry white spots remain.',
      'Air fry for 10–12 minutes, shaking the basket halfway through, until golden.',
    ],
    notes: [
      'Why potato starch or cornstarch? Unlike flour (which turns doughy without deep-frying), cornstarch bakes into a delicate, ultra-crispy shell in hot circulating air. The egg locks in the chicken’s juices so the inside stays tender.',
    ],
  },
}

export const MOCK_MEAL_PLAN: MealPlan = {
  days: [
    {
      date: '2026-07-27',
      meals: [
        { slot: 'Dinner', recipeId: 'ragu-bianco', title: 'Pork Ragù Bianco' },
      ],
    },
    {
      date: '2026-07-28',
      meals: [{ slot: 'Dinner', recipeId: 'miso-cod', title: 'Miso-Glazed Cod' }],
    },
    {
      date: '2026-07-29',
      meals: [
        { slot: 'Dinner', recipeId: 'charred-broccoli', title: 'Charred Broccoli' },
      ],
    },
    {
      date: '2026-07-30',
      meals: [{ slot: 'Dinner', recipeId: 'ragu-bianco', title: 'Ragù, again' }],
    },
    {
      date: '2026-07-31',
      meals: [{ slot: 'Dinner', recipeId: 'miso-cod', title: 'Miso-Glazed Cod' }],
    },
    { date: '2026-08-01', meals: [] },
    {
      date: '2026-08-02',
      meals: [
        { slot: 'Lunch', recipeId: 'charred-broccoli', title: 'Charred Broccoli' },
      ],
    },
  ],
}

export const MOCK_BRIEFING: Briefing = {
  dateLabel: 'Sunday, 26 July',
  weather: { temperature: 24, condition: 'Partly cloudy', high: 28, low: 17 },
  events: [
    { id: 'e1', time: '09:30', title: 'Farmers market run', location: 'Riverside' },
    { id: 'e2', time: '13:00', title: 'Lunch with Mei' },
    { id: 'e3', time: '19:00', title: 'Ragù goes on', location: 'Kitchen' },
  ],
  tasks: [
    { id: 't1', title: 'Order more olive oil', done: false },
    { id: 't2', title: 'Descale the kettle', done: false },
    { id: 't3', title: 'Defrost pork shoulder', done: true },
  ],
  // recipeIds match MOCK_RECIPES so tapping through to RecipeView works.
  meals: [
    { slot: 'Lunch', recipeId: 'charred-broccoli', title: 'Charred Broccoli' },
    { slot: 'Dinner', recipeId: 'ragu-bianco', title: 'Pork Ragù Bianco' },
  ],
}
