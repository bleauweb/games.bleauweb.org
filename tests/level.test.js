import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, OK_PLAYER_MARGIN } from '../games/gate-rush/src/level.js';
import { simulateBoss, applyGate, simulateEncounter } from '../games/gate-rush/src/combat.js';

test('levels are deterministic', () => {
  assert.deepEqual(generateLevel(7), generateLevel(7));
});

test('every level 1..80 is winnable by a best-choice player with room to spare', () => {
  for (let n = 1; n <= 80; n++) {
    const lvl = generateLevel(n);
    const r = simulateBoss(lvl.expected.best, lvl.boss.hp, lvl.boss.dps);
    assert.ok(r.won, `level ${n}: best player lost the boss`);
    assert.ok(r.count >= OK_PLAYER_MARGIN * lvl.expected.ok, `level ${n}: best player barely scraped by`);
  }
});

test('an ok player (right gate ~70% of the time) still wins every level', () => {
  for (let n = 1; n <= 80; n++) {
    const lvl = generateLevel(n);
    assert.ok(lvl.expected.ok >= 1, `level ${n}: ok player died on the lane`);
    const r = simulateBoss(lvl.expected.ok, lvl.boss.hp, lvl.boss.dps);
    assert.ok(r.won, `level ${n}: ok player lost the boss`);
  }
});

test('an always-wrong player replaying the lane never dies to a single gate', () => {
  // Gates are allowed to hurt, but no single gate may wipe a squad that took the worse
  // option everywhere before it. (Enemy groups can still finish such a squad; that is fair.)
  for (let n = 1; n <= 80; n++) {
    const lvl = generateLevel(n);
    let c = lvl.start;
    for (const row of lvl.rows) {
      if (row.type === 'gates') {
        const a = applyGate(Math.ceil(c), row.left);
        const b = applyGate(Math.ceil(c), row.right);
        c = Math.min(a, b);
        assert.ok(c >= 1, `level ${n}: a gate pair wiped the worst-case squad`);
      } else if (row.type === 'enemy') {
        c = simulateEncounter(c, row.count).count;
        if (c <= 0) break;
      }
    }
  }
});

test('levels get longer and the boss gets meaner', () => {
  const a = generateLevel(1);
  const b = generateLevel(30);
  assert.ok(b.rows.length > a.rows.length);
  assert.ok(b.boss.hp > a.boss.hp);
  assert.ok(a.rows.filter((r) => r.type === 'enemy').length >= 2);
});
