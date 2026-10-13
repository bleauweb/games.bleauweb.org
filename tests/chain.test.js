import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle, countSolutions, isComplete } from '../games/number-chain/src/chain.js';

test('puzzles have exactly one solution and the solution is a valid chain', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= (level.n >= 7 ? 4 : 10); seed++) {
      const p = makePuzzle(level, seed);
      const n = p.n;
      // Chain check: k and k+1 are neighbours.
      const pos = {};
      p.solution.forEach((r, y) => r.forEach((v, x) => { pos[v] = [x, y]; }));
      for (let k = 1; k < n * n; k++) {
        const [ax, ay] = pos[k];
        const [bx, by] = pos[k + 1];
        assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1, `${level.id} seed ${seed}: ${k}→${k + 1} not adjacent`);
      }
      assert.equal(countSolutions(p.givens), 1, `${level.id} seed ${seed}: not unique`);
      const givenCount = p.givens.flat().filter(Boolean).length;
      assert.ok(givenCount < n * n && givenCount >= 2, `${level.id}: ${givenCount} givens`);
      assert.ok(isComplete(p.solution, p.solution));
      assert.ok(!isComplete(p.givens, p.solution));
    }
  }
});
