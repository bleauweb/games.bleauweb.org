// Everything that is a number in Market Day: crops, animals, goods, upgrades, levels.

export const DAY_MS = 120_000; // one farm day
export const TRIP_MS = 2500; // the cart's trip to town
export const ANIMAL_STORE = 5; // uncollected produce an animal keeps
export const OFFLINE_CAP_MS = 12 * 3600_000;
export const PEDDLER_RATE = 0.5; // the passing peddler pays half price at the farm gate

export const CROPS = {
  wheat: { name: 'Wheat', seed: 5, grow: 20_000, price: 9, level: 1 },
  carrot: { name: 'Carrot', seed: 8, grow: 35_000, price: 16, level: 1 },
  tomato: { name: 'Tomato', seed: 15, grow: 60_000, price: 32, level: 2 },
  strawberry: { name: 'Strawberry', seed: 25, grow: 90_000, price: 60, level: 3 },
  corn: { name: 'Corn', seed: 40, grow: 150_000, price: 100, level: 4 },
  pumpkin: { name: 'Pumpkin', seed: 70, grow: 240_000, price: 190, level: 6 },
};

export const ANIMALS = {
  chicken: { name: 'Chicken', cost: 60, cycle: 45_000, product: 'egg', level: 2, barn: 1 },
  cow: { name: 'Cow', cost: 250, cycle: 90_000, product: 'milk', level: 4, barn: 2 },
  sheep: { name: 'Sheep', cost: 500, cycle: 180_000, product: 'wool', level: 6, barn: 3 },
};

export const PRODUCTS = {
  egg: { name: 'Egg', price: 12 },
  milk: { name: 'Milk', price: 40 },
  wool: { name: 'Wool', price: 110 },
};

/** Every sellable good with its base price. */
export const GOODS = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, v]) => [k, { name: v.name, price: v.price, level: v.level }])),
  ...Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, { name: v.name, price: v.price, level: ANIMALS[Object.keys(ANIMALS).find((a) => ANIMALS[a].product === k)].level }])),
};

export const UPGRADES = {
  field: {
    name: 'Field',
    base: 'A small field: 6 plots.',
    levels: [
      { name: 'Cleared land', cost: 120, level: 1, desc: '9 plots', plots: 9 },
      { name: 'Lower meadow', cost: 450, level: 2, desc: '12 plots', plots: 12 },
      { name: 'Hillside terraces', cost: 1500, level: 4, desc: '16 plots', plots: 16 },
      { name: 'The old orchard', cost: 4000, level: 6, desc: '20 plots', plots: 20 },
    ],
  },
  water: {
    name: 'Watering',
    base: 'A watering can. Crops grow at normal speed.',
    levels: [
      { name: 'Sprinklers', cost: 150, level: 2, desc: 'Crops grow 25% faster', speed: 1.25 },
      { name: 'Drip irrigation', cost: 700, level: 4, desc: 'Crops grow 50% faster', speed: 1.5 },
      { name: 'Greenhouse', cost: 2500, level: 6, desc: 'Crops grow twice as fast, whatever the weather', speed: 2, weatherproof: true },
    ],
  },
  tools: {
    name: 'Tools',
    base: 'A hoe. One plot at a time.',
    levels: [
      { name: 'Seed drill', cost: 200, level: 2, desc: 'Plant every empty plot with one tap' },
      { name: 'Harvester', cost: 900, level: 4, desc: 'Harvest every ripe plot with one tap' },
      { name: 'Tractor', cost: 3000, level: 5, desc: 'Harvesting replants the same crop for free' },
    ],
  },
  cart: {
    name: 'Cart',
    base: 'A handcart. Carries 10 goods to town.',
    levels: [
      { name: 'Wagon', cost: 100, level: 1, desc: 'Carries 25', capacity: 25 },
      { name: 'Truck', cost: 500, level: 3, desc: 'Carries 60', capacity: 60 },
      { name: 'Lorry', cost: 2000, level: 5, desc: 'Carries 150', capacity: 150 },
      { name: 'Convoy', cost: 6000, level: 7, desc: 'Carries 400', capacity: 400 },
    ],
  },
  barn: {
    name: 'Barn',
    base: 'No animals yet.',
    levels: [
      { name: 'Chicken coop', cost: 80, level: 2, desc: '2 animal slots, chickens', slots: 2 },
      { name: 'Barn', cost: 400, level: 4, desc: '4 slots, cows', slots: 4 },
      { name: 'Big barn', cost: 1500, level: 6, desc: '6 slots, sheep', slots: 6 },
      { name: 'Ranch', cost: 4000, level: 7, desc: '9 slots', slots: 9 },
    ],
  },
  stall: {
    name: 'Market stall',
    base: 'You sell from the back of the cart.',
    levels: [
      { name: 'Market stall', cost: 250, level: 2, desc: 'Town prices +10%', bonus: 1.1 },
      { name: 'Village shop', cost: 1200, level: 4, desc: 'Town prices +25%', bonus: 1.25 },
      { name: 'Famous brand', cost: 3500, level: 6, desc: 'Town prices +45%', bonus: 1.45 },
    ],
  },
  scarecrow: {
    name: 'Scarecrow',
    base: 'Crows steal a crop now and then.',
    levels: [{ name: 'Scarecrow', cost: 90, level: 1, desc: 'Crows leave the field alone' }],
  },
  golden: {
    name: 'Golden Tractor',
    base: 'The prize of the county. Buy it and you have made it.',
    levels: [{ name: 'Golden Tractor', cost: 12000, level: 7, desc: 'Win the game', win: true }],
  },
};

export const CART_BASE = 10;
export const PLOTS_BASE = 6;

/** XP needed to reach level n (cumulative). */
export function xpForLevel(n) {
  return n <= 1 ? 0 : Math.round(100 * (n - 1) ** 1.6);
}

export function levelForXp(xp) {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export const WEATHER = {
  sunny: { name: 'Sunny', speed: 1 },
  rain: { name: 'Rain', speed: 1.3 },
  heat: { name: 'Heatwave', speed: 0.7 },
  mist: { name: 'Misty', speed: 0.9 },
};
