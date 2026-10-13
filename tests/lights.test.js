import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePuzzle, press, allOff } from '../games/light-switch/src/lights.js';

test('a press toggles the plus shape and pressing the solution clears the board', () => {
  const g = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  press(g, 1, 1);
  assert.deepEqual(g, [[0, 1, 0], [1, 1, 1], [0, 1, 0]]);
  press(g, 0, 0);
  assert.deepEqual(g, [[1, 0, 0], [0, 1, 1], [0, 1, 0]]);
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 40; seed++) {
      const p = makePuzzle(level, seed);
      assert.ok(!allOff(p.grid), `${level.id} seed ${seed}: starts solved`);
      const g2 = p.grid.map((r) => [...r]);
      for (const [x, y] of p.solution) press(g2, x, y);
      assert.ok(allOff(g2), `${level.id} seed ${seed}: solution does not clear`);
    }
  }
});
