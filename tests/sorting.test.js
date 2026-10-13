import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle } from '../games/sort-and-stack/src/sorting.js';

test('every puzzle has well-formed bins, enough items per bin, and examples for hidden rules', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makePuzzle(level, seed * 11 + 3);
      assert.ok(p.bins.length >= 2 && p.bins.length <= 4, `${level.id}: ${p.bins.length} bins`);
      assert.ok(p.items.length >= level.items, `${level.id}: ${p.items.length} items`);
      const counts = new Array(p.bins.length).fill(0);
      for (const it of p.items) {
        assert.ok(it.bin >= 0 && it.bin < p.bins.length, `${level.id}: item outside bins`);
        counts[it.bin]++;
      }
      assert.ok(counts.every((n) => n >= 2), `${level.id} seed ${seed}: bin counts ${counts}`);
      if (!p.labelled) {
        assert.equal(p.examples.length, p.bins.length);
        assert.ok(p.bins.every((b) => b.label === '?'));
      } else assert.equal(p.examples.length, 0);
      assert.ok(p.explain.length > 10);
      assert.ok(p.attrHint.startsWith('Look at'));
    }
  }
});
