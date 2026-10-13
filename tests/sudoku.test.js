import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle, solveSingles, countSolutions, candidates, conflicts } from '../games/sudoku-calm/src/sudoku.js';

test('puzzles are unique and solvable by singles; solutions are valid', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= (level.n === 9 ? 3 : 8); seed++) {
      const p = makePuzzle(level, seed);
      const n = level.n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        assert.ok(p.solution[y][x] >= 1 && p.solution[y][x] <= n);
        assert.ok(!conflicts(level, p.solution, x, y), `${level.id} seed ${seed}: solution conflicts at ${x},${y}`);
      }
      const s = solveSingles(level, p.givens);
      assert.ok(s.solved, `${level.id} seed ${seed}: needs more than singles`);
      assert.deepEqual(s.grid, p.solution);
      assert.equal(countSolutions(level, p.givens), 1, `${level.id} seed ${seed}: not unique`);
      const given = p.givens.flat().filter(Boolean).length;
      assert.ok(given < n * n && given >= Math.round(n * n * level.keep) - 1);
    }
  }
  const g = [[1, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  assert.deepEqual(candidates(LEVELS[0], g, 2, 0), [3, 4]);
  assert.deepEqual(candidates(LEVELS[0], g, 0, 1), [3, 4]);
});
