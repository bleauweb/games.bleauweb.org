import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle, countSolutions, consistent, problems } from '../games/binary-grid/src/binary.js';

test('rules', () => {
  assert.ok(consistent([[0, 0, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]));
  assert.ok(!consistent([[0, 0, 0, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]), 'three in a row');
  assert.ok(!consistent([[0, 0, 1, 0], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]), 'too many zeros');
  assert.ok(!consistent([[0, 1, 0, 1], [0, 1, 0, 1], [-1, -1, -1, -1], [-1, -1, -1, -1]]), 'identical rows');
  assert.deepEqual(problems([[1, 1, 1, 0], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]), ['row 1: three in a row']);
});

test('every puzzle has exactly one solution, which obeys all rules', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= (level.n >= 10 ? 2 : level.n >= 8 ? 4 : 8); seed++) {
      const p = makePuzzle(level, seed);
      assert.ok(consistent(p.solution), `${level.id} seed ${seed}: solution breaks a rule`);
      assert.ok(p.solution.flat().every((v) => v !== -1));
      assert.equal(countSolutions(p.givens), 1, `${level.id} seed ${seed}: not unique`);
      const given = p.givens.flat().filter((v) => v !== -1).length;
      assert.ok(given < level.n * level.n, 'something to solve');
    }
  }
});
