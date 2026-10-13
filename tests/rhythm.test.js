import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePattern, compare, scoreTaps } from '../games/rhythm-patterns/src/rhythm.js';

test('patterns have the right shape and are never trivial', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 30; seed++) {
      const p = makePattern(level, seed);
      assert.equal(p.rows.length, level.rows);
      for (const row of p.rows) {
        assert.equal(row.length, level.steps);
        const n = row.filter(Boolean).length;
        assert.ok(n >= 2 && n <= level.steps - 2, `${level.id} seed ${seed}: ${n} hits`);
      }
      assert.equal(p.rows[0][0], 1, 'the first step is always a hit so the pattern has a clear start');
    }
  }
});

test('comparison and tap scoring', () => {
  const p = { steps: 4, rows: [[1, 0, 1, 0]] };
  assert.ok(compare([[1, 0, 1, 0]], p).match);
  const r = compare([[1, 1, 1, 0]], p);
  assert.equal(r.wrong, 1);
  assert.deepEqual(r.cells, [[0, 1]]);
  const s = scoreTaps([10, 1020, 1400], [1, 0, 1, 0], 500, 150);
  assert.deepEqual(s, { hits: 2, misses: 0, extra: 1, total: 2 });
  assert.equal(scoreTaps([], [1, 0, 1, 0], 500).misses, 2);
});
