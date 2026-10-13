import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../games/shipping-lanes/src/ships.js';

function bot(seed, maxDays = 45) {
  let now = 0;
  const s = S.newGame(now, seed);
  while (!s.won && s.day <= maxDays) {
    now += 1000;
    S.tick(s, now);
    if (s.voyage) continue;
    for (const g of Object.keys(s.cargo)) {
      // Sell what this port pays well for (or anything if we have been carrying it a while).
      if (S.price(s, s.port, g) >= S.GOODS[g].price) S.sell(s, g, s.cargo[g]);
    }
    for (const id of ['flagship', 'ship', 'charts', 'sails', 'hull', 'ship', 'sails', 'hull', 'ship']) {
      if (S.canBuy(s, id) && (id === 'flagship' || s.coins - S.nextUpgrade(s, id).cost > 200)) S.buyUpgrade(s, id);
    }
    const t = S.bestTrade(s);
    if (t && t.margin > 0) {
      S.buy(s, t.good, 9999);
      S.sail(s, t.to, now);
    } else {
      // Nothing good here: move on to the nearest other port.
      const next = S.PORTS.filter((p) => p.id !== s.port).sort((a, b) => S.distance(s.port, a.id) - S.distance(s.port, b.id))[0];
      S.sail(s, next.id, now);
    }
  }
  return s;
}

test('a plain trader buys the flagship within 45 days on several seeds', () => {
  for (const seed of [1, 2, 3, 77, 2024]) {
    const s = bot(seed);
    assert.ok(s.won, `seed ${seed}: not won by day ${s.day} (coins ${s.coins})`);
  }
});

test('prices stay inside their bands and specialities hold', () => {
  let now = 0;
  const s = S.newGame(now, 9);
  for (let d = 0; d < 100; d++) {
    now += S.DAY_MS;
    S.tick(s, now);
    for (const p of S.PORTS) for (const g of Object.keys(S.GOODS)) {
      const base = S.baseMult(p, g);
      const m = s.prices[p.id][g];
      assert.ok(m >= base * 0.6 - 1e-9 && m <= base * 1.6 + 1e-9, `${p.id} ${g} ${m}`);
    }
  }
  assert.ok(S.price(s, 'zanzibar', 'spices') < S.price(s, 'lisbon', 'spices'));
});

test('voyages take time, cargo respects capacity, charts reveal prices', () => {
  const s = S.newGame(0, 1);
  assert.equal(S.buy(s, 'wine', 100), 20, 'sloop holds 20');
  assert.ok(S.sail(s, 'canton', 0));
  assert.ok(!S.buy(s, 'wine', 1), 'cannot trade at sea');
  S.tick(s, 1000);
  assert.ok(s.voyage);
  S.tick(s, S.voyageMs(s, 'lisbon', 'canton') + 1);
  assert.equal(s.port, 'canton');
  assert.equal(s.voyage, null);
  assert.equal(S.knownPrice(s, 'lisbon', 'silk').live, false);
  s.coins = 1e6;
  S.buyUpgrade(s, 'charts');
  assert.equal(S.knownPrice(s, 'lisbon', 'silk').live, true);
});
