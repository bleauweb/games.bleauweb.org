import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../games/workshop/src/workshop.js';

/** Buy materials for a recipe (recursively through parts) if affordable, then queue it. */
function make(s, id) {
  const r = W.RECIPES[id];
  for (const [k, n] of Object.entries(r.needs)) {
    while (W.have(s, k) < n) {
      if (W.MATERIALS[k]) {
        if (!W.buyMaterial(s, k, n - W.have(s, k))) return false;
      } else if (!make(s, k)) return false;
      else return 'queued-part';
    }
  }
  return W.queue(s, id);
}

function bot(seed, maxDays = 60) {
  let now = 0;
  const s = W.newGame(now, seed);
  while (!s.won && s.day <= maxDays) {
    now += 1000;
    W.tick(s, now);
    for (const o of [...s.orders]) if (W.canFulfil(s, o)) W.fulfil(s, o.id);
    for (const id of ['jeweler', 'tools', 'stations', 'bellows', 'supplier', 'apprentice', 'tools', 'stations', 'supplier']) {
      if (W.canBuy(s, id) && s.coins - W.nextUpgrade(s, id).cost > 60) W.buyUpgrade(s, id);
    }
    // Sell finished goods we are not saving for an order.
    for (const id of Object.keys(W.RECIPES)) {
      if (W.RECIPES[id].masterwork || !W.have(s, id)) continue;
      const needed = s.orders.filter((o) => o.recipe === id).reduce((n, o) => n + o.qty, 0);
      const isPart = ['plank', 'ingot', 'strap'].includes(id);
      const extra = W.have(s, id) - needed - (isPart ? 3 : 0) - (id === 'clock' && W.recipeUnlocked(s, 'greatclock') ? 1 : 0);
      if (extra > 0) W.sellItem(s, id, extra);
    }
    // Craft: the masterwork when possible, else orders, else the best-margin unlocked good.
    if (W.recipeUnlocked(s, 'greatclock') && !s.stations.jeweler.jobs.some((j) => j.recipe === 'greatclock')) make(s, 'greatclock');
    for (const o of s.orders) if (!W.canFulfil(s, o)) make(s, o.recipe);
    const goods = Object.keys(W.RECIPES).filter((id) => !W.RECIPES[id].masterwork && W.recipeUnlocked(s, id) && !['plank', 'ingot', 'strap'].includes(id))
      .sort((a, b) => (W.RECIPES[b].price - W.costOf(s, b)) / W.RECIPES[b].time - (W.RECIPES[a].price - W.costOf(s, a)) / W.RECIPES[a].time);
    for (const id of goods) { if (s.coins > W.costOf(s, id) + 30) make(s, id); }
  }
  return s;
}

test('a steady craftsman finishes the Great Clock within 60 days on several seeds', () => {
  for (const seed of [1, 5, 42, 300, 9001]) {
    const s = bot(seed);
    assert.ok(s.won, `seed ${seed}: not won by day ${s.day} (level ${W.level(s)}, coins ${s.coins})`);
  }
});

test('stations run jobs in slots and chain correctly after time away', () => {
  const s = W.newGame(0, 1);
  s.inventory.wood = 8;
  assert.ok(W.queue(s, 'plank'));
  assert.ok(W.queue(s, 'plank'));
  assert.equal(s.stations.bench.jobs.filter((j) => j.startedAt !== null).length, 1, 'one slot');
  W.tick(s, 8_000);
  assert.equal(W.have(s, 'plank'), 1);
  W.tick(s, 16_000);
  assert.equal(W.have(s, 'plank'), 2, 'second job started when the first finished');
  assert.equal(s.stations.bench.jobs.length, 0);
  // Long absence: three queued jobs all complete.
  s.inventory.wood = 6;
  W.queue(s, 'plank');
  W.queue(s, 'plank');
  W.queue(s, 'plank');
  W.tick(s, 16_000 + 3600_000);
  assert.equal(W.have(s, 'plank'), 5);
});

test('recipes and orders are sane', () => {
  for (const [id, r] of Object.entries(W.RECIPES)) {
    assert.ok(W.STATIONS[r.station], `${id} station`);
    for (const k of Object.keys(r.needs)) assert.ok(W.MATERIALS[k] || W.RECIPES[k], `${id} needs ${k}`);
    if (!r.masterwork) {
      const s = W.newGame(0, 1);
      assert.ok(r.price > W.costOf(s, id), `${id} should be profitable at base prices`);
    }
  }
  const s = W.newGame(0, 2);
  assert.equal(s.orders.length, 3);
  for (const o of s.orders) assert.ok(o.pay > W.RECIPES[o.recipe].price * o.qty);
});
