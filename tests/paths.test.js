import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle, isSolved } from '../games/circuit-paths/src/paths.js';

test('every level makes puzzles whose built-in solution fills the grid and connects every pair', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 30; seed++) {
      const p = makePuzzle(level, seed);
      assert.ok(p.pairs.length >= level.minPaths && p.pairs.length <= level.maxPaths, `${level.id} seed ${seed}: ${p.pairs.length} pairs`);
      assert.ok(isSolved(p.n, p.pairs, p.solution), `${level.id} seed ${seed}: solution does not solve`);
      // Breaking one path must fail.
      const broken = p.solution.map((s) => [...s]);
      broken[0] = broken[0].slice(0, -1);
      assert.ok(!isSolved(p.n, p.pairs, broken));
      // Endpoints are distinct cells.
      const ends = new Set(p.pairs.flatMap((q) => [`${q.a}`, `${q.b}`]));
      assert.equal(ends.size, p.pairs.length * 2);
    }
  }
});
