import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle } from '../games/odd-one-out/src/odd.js';

test('exactly one item breaks the rule and no other feature singles out a different item', () => {
  const ATTRS = ['shape', 'color', 'size', 'fill', 'count'];
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 60; seed++) {
      const p = makePuzzle(level, seed);
      assert.equal(p.items.length, level.items);
      // Only the odd item should be the unique holder of some attribute value.
      const uniqueHolders = new Set();
      for (const a of ATTRS) {
        const counts = {};
        for (const it of p.items) counts[it[a]] = (counts[it[a]] || 0) + 1;
        for (const it of p.items) if (counts[it[a]] === 1 && Object.keys(counts).length === 2) uniqueHolders.add(it.id);
      }
      assert.ok(uniqueHolders.has(p.odd), `${level.id} seed ${seed}: odd item is not singled out`);
      assert.equal(uniqueHolders.size, 1, `${level.id} seed ${seed}: more than one candidate (${[...uniqueHolders]})`);
      assert.ok(p.explain.includes('share'));
    }
  }
});
