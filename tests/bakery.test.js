import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../games/bakery-rush/src/bakery.js';

function bot(seed, maxDays = 60) {
  let now = 0;
  const s = B.newGame(now, seed);
  while (!s.won && s.day <= maxDays) {
    now += 1000;
    B.tick(s, now);
    for (const id of ['whisk', 'ovens', 'counter', 'heat', 'mixer', 'ovens', 'coffee', 'bike', 'heat', 'mixer', 'counter', 'ovens']) {
      if (B.canBuy(s, id) && (id === 'whisk' || s.coins - B.nextUpgrade(s, id).cost > 40)) B.buyUpgrade(s, id);
    }
    // Keep the shelf stocked: bake the best value-per-oven-second recipe we can afford, special first.
    const ranked = Object.keys(B.RECIPES).filter((r) => B.recipeUnlocked(s, r))
      .sort((a, b) => (B.sellPrice(s, b) * B.RECIPES[b].yield - B.costOf(s, b)) / B.RECIPES[b].time - (B.sellPrice(s, a) * B.RECIPES[a].yield - B.costOf(s, a)) / B.RECIPES[a].time);
    while (s.ovens.length < B.ovenCount(s)) {
      const r = ranked.find((id) => B.shelfCount(s, id) < 12 && s.coins >= B.costOf(s, id)) || ranked.find((id) => s.coins >= B.costOf(s, id));
      if (!r) break;
      for (const [k, n] of Object.entries(B.RECIPES[r].needs)) if ((s.pantry[k] || 0) < n) B.buy(s, k, n - (s.pantry[k] || 0));
      if (!B.bake(s, r, now)) break;
    }
  }
  return s;
}

test('a diligent baker wins the Golden Whisk within 60 days on several seeds', () => {
  for (const seed of [1, 4, 42, 777, 31337]) {
    const s = bot(seed);
    assert.ok(s.won, `seed ${seed}: not won by day ${s.day} (coins ${s.coins}, level ${B.level(s)}, rep ${s.reputation})`);
  }
});

test('ovens, shelf, customers and freshness behave', () => {
  const s = B.newGame(0, 1);
  s.coins = 1000;
  B.buy(s, 'flour', 10);
  B.buy(s, 'milk', 5);
  assert.ok(B.bake(s, 'bread', 0));
  assert.ok(!B.bake(s, 'bread', 0), 'only one oven');
  B.tick(s, 30_000);
  assert.equal(B.shelfCount(s, 'bread'), 4);
  const fresh = B.sellPrice(s, 'bread', s.day);
  const old = B.sellPrice(s, 'bread', s.day - 1);
  assert.ok(old < fresh);
  B.tick(s, B.DAY_MS * 2 + 1);
  assert.equal(B.shelfCount(s), 0, 'stale bread was thrown out or sold');
  assert.ok(s.stats.customers > 10);
});

test('farm deliveries move goods from a Market Day inventory into the pantry', () => {
  const s = B.newGame(0, 1);
  const farm = { wheat: 5, egg: 2, milk: 3 };
  assert.equal(B.buyFromFarm(s, farm, 'wheat', 3), 3);
  assert.equal(farm.wheat, 2);
  assert.equal(s.pantry.flour, 6);
  assert.equal(s.coins, 57);
  assert.equal(B.buyFromFarm(s, farm, 'egg', 10), 2);
  assert.equal(s.pantry.eggs, 2);
});
