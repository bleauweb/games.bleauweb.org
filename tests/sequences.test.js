import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle } from '../games/sequence-lab/src/sequences.js';

test('every level makes valid puzzles: four distinct options, the answer among them, an explanation', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 150; seed++) {
      const p = makePuzzle(level, seed * 7 + LEVELS.indexOf(level));
      assert.equal(p.options.length, 4, `${level.id} seed ${seed}: ${p.options.length} options`);
      assert.equal(new Set(p.options.map((o) => o.value)).size, 4, `${level.id} seed ${seed}: duplicate options`);
      assert.ok(p.options.some((o) => o.value === p.answer), `${level.id} seed ${seed}: answer missing`);
      assert.ok(p.explain.length > 10);
      assert.ok(p.shown.length >= 5);
      if (p.kind === 'number') {
        assert.ok(p.shown.every((n) => Number.isInteger(n)), `${level.id} seed ${seed}: non-integer term`);
        assert.ok(Number.isInteger(p.answer));
      }
    }
  }
});

test('puzzles are deterministic for a seed', () => {
  assert.deepEqual(makePuzzle(LEVELS[1], 99), makePuzzle(LEVELS[1], 99));
  assert.notDeepEqual(makePuzzle(LEVELS[0], 1).shown, makePuzzle(LEVELS[0], 2).shown);
});
