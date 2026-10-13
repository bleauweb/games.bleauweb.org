import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PICTURES, pictureGrid, cluesOf, solve, solveLine, matches, makePuzzle, LEVELS, lineClues, UNKNOWN, FILL, EMPTY } from '../games/tile-logic/src/nonogram.js';

test('clues and line solving', () => {
  assert.deepEqual(lineClues([1, 1, 0, 1, 0, 0, 1, 1, 1]), [2, 1, 3]);
  assert.deepEqual(lineClues([0, 0, 0]), [0]);
  // A full-length block is forced.
  assert.deepEqual(solveLine([5], new Array(5).fill(UNKNOWN)), [FILL, FILL, FILL, FILL, FILL]);
  // [3] in 5: the middle cell is certain, the ends are not.
  assert.deepEqual(solveLine([3], new Array(5).fill(UNKNOWN)), [UNKNOWN, UNKNOWN, FILL, UNKNOWN, UNKNOWN]);
  // [0] empties the line.
  assert.deepEqual(solveLine([0], new Array(4).fill(UNKNOWN)), [EMPTY, EMPTY, EMPTY, EMPTY]);
  // Known cells prune placements: [2] with the first cell empty and the last filled.
  assert.deepEqual(solveLine([2], [EMPTY, UNKNOWN, UNKNOWN, FILL]), [EMPTY, EMPTY, FILL, FILL]);
});

test('every library picture is 10×10 and solvable by line logic to exactly that picture', () => {
  for (const [name, rows] of Object.entries(PICTURES)) {
    assert.equal(rows.length, 10, `${name} rows`);
    for (const r of rows) assert.equal(r.length, 10, `${name}: row "${r}"`);
    const grid = pictureGrid(name);
    const { rows: rc, cols: cc } = cluesOf(grid);
    const res = solve(rc, cc);
    assert.ok(res.solved, `${name} is not deducible by line logic`);
    assert.deepEqual(res.grid.map((r) => r.map((c) => (c === FILL ? 1 : 0))), grid, `${name} solves to something else`);
  }
});

test('random levels produce deducible puzzles for many seeds, and matches() accepts the solution', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 25; seed++) {
      const p = makePuzzle(level, seed);
      assert.equal(p.size, level.size);
      const fill = p.solution.map((r) => r.map((c) => (c ? FILL : EMPTY)));
      assert.ok(matches(fill, p.rows, p.cols), `${level.id} seed ${seed}`);
      const wrong = fill.map((r) => [...r]);
      wrong[0][0] = wrong[0][0] === FILL ? EMPTY : FILL;
      assert.ok(!matches(wrong, p.rows, p.cols));
    }
  }
});
