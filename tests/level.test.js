import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, OK_PLAYER_MARGIN } from '../games/gate-rush/src/level.js';
import { simulateBoss, applyGate, simulateEncounter, squadStrength } from '../games/gate-rush/src/combat.js';

test('levels are deterministic', () => {
  assert.deepEqual(generateLevel(7), generateLevel(7));
});

test('every level 1..80 is winnable by a best-choice player with room to spare', () => {
  for (let n = 1; n <= 80; n++) {
    const lvl = generateLevel(n);
    const r = simulateBoss(lvl.expected.best, lvl.boss.hp, lvl.boss.dps);
    assert.ok(r.won, `level ${n}: best player lost the boss`);
    assert.ok(r.squad.count >= OK_PLAYER_MARGIN * lvl.expected.best.count, `level ${n}: best player barely scraped by`);
  }
});

test('an ok player (right gate ~70% of the time) still wins every level', () => {
  for (let n = 1; n <= 80; n++) {
    const lvl = generateLevel(n);
    assert.ok(lvl.expected.ok.count >= 1, `level ${n}: ok player died on the lane`);
    const r = simulateBoss(lvl.expected.ok, lvl.boss.hp, lvl.boss.dps);
    assert.ok(r.won, `level ${n}: ok player lost the boss`);
  }
});

test('an always-wrong player never dies to a single gate', () => {
  for (let n = 1; n <= 80; n++) {
    const lvl = generateLevel(n);
    let s = { ...lvl.start };
    for (const row of lvl.rows) {
      if (row.type === 'gates') {
        const a = applyGate(s, row.left);
        const b = applyGate(s, row.right);
        s = squadStrength(a) <= squadStrength(b) ? a : b;
        assert.ok(s.count >= 1, `level ${n}: a gate pair wiped the worst-case squad`);
      } else if (row.type === 'enemy') {
        s = simulateEncounter(s, row.count).squad;
        if (s.count <= 0) break;
      }
    }
  }
});

test('the new gate kinds show up and matter', () => {
  const ops = new Set();
  for (let n = 1; n <= 30; n++) {
    for (const row of generateLevel(n).rows) {
      if (row.type === 'gates') {
        ops.add(row.left.op);
        ops.add(row.right.op);
      }
    }
  }
  assert.ok(ops.has('tier'), 'no UPGRADE gates');
  assert.ok(ops.has('hero'), 'no HERO gates');
  const s = { count: 20, tier: 0, hero: 1 };
  assert.ok(squadStrength(applyGate(s, { op: 'tier' })) > squadStrength(s));
  assert.ok(squadStrength(applyGate(s, { op: 'hero', value: 3 })) > squadStrength(s));
});

test('levels get longer and the boss gets meaner', () => {
  const a = generateLevel(1);
  const b = generateLevel(30);
  assert.ok(b.rows.length > a.rows.length);
  assert.ok(b.boss.hp > a.boss.hp);
  assert.ok(a.rows.filter((r) => r.type === 'enemy').length >= 2);
});
