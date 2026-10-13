import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../games/market-day/src/economy.js';
import { CROPS, UPGRADES, DAY_MS, GOODS } from '../games/market-day/src/data.js';

function bestCrop(state) {
  // Profit per second among affordable, unlocked crops.
  let best = null;
  let bestRate = -1;
  for (const [id, c] of Object.entries(CROPS)) {
    if (!E.cropUnlocked(state, id) || state.coins < c.seed) continue;
    const rate = (E.townPrice(state, id) - c.seed) / c.grow;
    if (rate > bestRate) {
      bestRate = rate;
      best = id;
    }
  }
  return best;
}

const ORDER = ['scarecrow', 'cart', 'field', 'water', 'barn', 'tools', 'stall', 'cart', 'field', 'water', 'barn', 'tools', 'stall', 'cart', 'field', 'barn', 'water', 'tools', 'stall', 'cart', 'field', 'barn', 'golden'];

/** A plain greedy farmer: plant, harvest, sell in town, fill orders, buy upgrades in a sensible order. */
function playBot(seed, maxDays = 60) {
  let now = 0;
  const s = E.newGame(now, seed);
  let step = 0;
  while (!s.won && s.day <= maxDays) {
    now += 1000;
    E.tick(s, now);
    for (let i = 0; i < s.plots.length; i++) if (s.plots[i].crop && s.plots[i].progress >= 1) E.harvest(s, i);
    E.collectAll(s);
    for (const o of [...s.orders]) if (E.canFulfil(s, o)) E.fulfil(s, o.id);
    for (let i = 0; i < s.plots.length; i++) {
      if (!s.plots[i].crop) {
        const c = bestCrop(s);
        if (c) E.plant(s, i, c);
      }
    }
    // Sell when the cart would be full or every so often, unless prices are poor and we can wait.
    const stock = Object.values(s.inventory).reduce((a, b) => a + b, 0);
    if (stock >= E.cartCapacity(s) || step % 30 === 0) {
      E.loadBest(s);
      E.sellCart(s);
    }
    // Buy animals when there is room and money to spare.
    for (const type of ['sheep', 'cow', 'chicken']) {
      while (E.animalUnlocked(s, type) && s.animals.length < E.barnSlots(s) && s.coins > 300 + 2 * (type === 'sheep' ? 500 : type === 'cow' ? 250 : 60)) E.buyAnimal(s, type);
    }
    // Upgrades in order; skip ones not yet unlocked by level, revisit later.
    for (const id of ORDER) {
      if (E.canBuy(s, id) && (id === 'golden' || s.coins - E.nextUpgrade(s, id).cost >= 40)) E.buyUpgrade(s, id);
    }
    // Never sit on zero: the peddler buys anything.
    if (s.coins < E.cheapestSeed(s) && stock > 0) {
      for (const g of Object.keys(s.inventory)) E.sellToPeddler(s, g, s.inventory[g]);
    }
    step++;
  }
  return s;
}

test('a greedy farmer wins the Golden Tractor well within 60 days, on several seeds', () => {
  for (const seed of [1, 7, 42, 1234, 99999]) {
    const s = playBot(seed);
    assert.ok(s.won, `seed ${seed}: not won by day ${s.day} (coins ${s.coins}, level ${E.level(s)})`);
    assert.ok(s.wonDay <= 60, `seed ${seed}: won on day ${s.wonDay}`);
  }
});

test('prices stay within bounds and every good gets a price each day', () => {
  let now = 0;
  const s = E.newGame(now, 5);
  for (let d = 0; d < 200; d++) {
    now += DAY_MS;
    E.tick(s, now);
    for (const g of Object.keys(GOODS)) {
      assert.ok(s.prices[g] >= 0.5 && s.prices[g] <= 2, `${g} price ${s.prices[g]}`);
    }
    assert.equal(s.orders.length, 3);
  }
  assert.equal(s.day, 201);
});

test('growth catches up after time away, capped at twelve hours', () => {
  const s = E.newGame(0, 1);
  E.plant(s, 0, 'wheat');
  E.tick(s, 10_000);
  assert.ok(Math.abs(s.plots[0].progress - 0.5) < 1e-9);
  E.tick(s, 1000 * 3600 * 24);
  assert.equal(s.plots[0].progress, 1);
  assert.ok(s.day > 1);
});

test('the cart has a capacity and the peddler always buys', () => {
  const s = E.newGame(0, 1);
  s.inventory.wheat = 30;
  assert.equal(E.load(s, 'wheat', 30), 10);
  assert.equal(E.cartLoad(s), 10);
  assert.equal(E.sellCart(s), 10 * E.townPrice(s, 'wheat'));
  assert.equal(E.sellToPeddler(s, 'wheat', 20), 20 * E.peddlerPrice(s, 'wheat'));
  assert.equal(s.inventory.wheat, 0);
});

test('upgrade tables are consistent', () => {
  for (const [id, u] of Object.entries(UPGRADES)) {
    let last = 0;
    for (const lv of u.levels) {
      assert.ok(lv.cost > last, `${id}: costs should rise`);
      last = lv.cost;
    }
  }
  const s = E.newGame(0, 1);
  s.coins = 1e6;
  s.xp = 1e6;
  E.buyUpgrade(s, 'field');
  assert.equal(s.plots.length, 9);
  E.buyUpgrade(s, 'tools');
  assert.equal(E.plantAll(s, 'wheat'), 9);
});
