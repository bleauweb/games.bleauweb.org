import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle, solve, cluesFor, isComplete, FILL } from '../games/mosaic-numbers/src/mosaic.js';

test('clues count the 3×3 block including the cell, and full clue sets solve', () => {
  const g = [[1, 1, 0], [1, 1, 0], [0, 0, 0]];
  const mask = g.map((r) => r.map(() => true));
  const c = cluesFor(g, mask);
  assert.equal(c[1][1], 4);
  assert.equal(c[0][0], 4, 'a corner clue counts its four neighbours');
  assert.equal(c[2][2], 1);
  assert.equal(c[2][0], 2);
  const r = solve(c);
  assert.ok(r.solved, 'a 4 in the corner fills its block, a 0-style edge empties the rest');
  assert.deepEqual(r.grid.map((row) => row.map((v) => (v === FILL ? 1 : 0))), g);
});

test('every level makes puzzles solvable by propagation alone, matching the picture', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= (level.n >= 12 ? 4 : 10); seed++) {
      const p = makePuzzle(level, seed);
      const r = solve(p.clues);
      assert.ok(r.solved, `${level.id} seed ${seed}: needs guessing`);
      assert.ok(isComplete(r.grid, p.solution), `${level.id} seed ${seed}: solved to something else`);
      const given = p.clues.flat().filter((v) => v !== null).length;
      assert.ok(given < p.n * p.n, 'some clues removed');
    }
  }
});
