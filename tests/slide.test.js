import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, scramble, move, isSolved, solvable, solvedTiles, pictureSvg } from '../games/slide-picture/src/slide.js';

test('scrambles are always solvable and moves slide rows and columns', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 40; seed++) {
      const s = scramble(level.n, level.shuffle, seed);
      assert.ok(!isSolved(s));
      assert.ok(solvable(level.n, s.tiles), `${level.id} seed ${seed}: unsolvable scramble`);
      assert.equal(new Set(s.tiles).size, level.n * level.n);
    }
  }
  const s = { n: 3, tiles: solvedTiles(3), moves: 0 };
  assert.ok(!move(s, 0), 'far tile does not move');
  assert.ok(move(s, 6), 'a whole row shifts toward the blank');
  assert.deepEqual(s.tiles, [1, 2, 3, 4, 5, 6, 0, 7, 8]);
  assert.ok(move(s, 0), 'a whole column shifts toward the blank');
  assert.deepEqual(s.tiles, [0, 2, 3, 1, 5, 6, 4, 7, 8]);
  assert.equal(s.moves, 2);
  assert.ok(pictureSvg(7).startsWith('data:image/svg+xml'));
  assert.equal(pictureSvg(7), pictureSvg(7));
});
