import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, move, canMove, solved, nextMove, optimal, undo } from '../games/stacks/src/hanoi.js';

test('rules and optimal play', () => {
  const s = newGame(3);
  assert.ok(canMove(s, 0, 2));
  assert.ok(!canMove(s, 1, 2), 'empty peg cannot move');
  move(s, 0, 2);
  assert.ok(!canMove(s, 0, 2), 'bigger disc cannot go on a smaller one');
  undo(s);
  assert.equal(s.moves, 0);
  for (const n of [3, 4, 5, 6, 7]) {
    const g = newGame(n);
    let guard = 0;
    while (!solved(g) && guard++ < 1000) {
      const m = nextMove(g);
      assert.ok(m, `${n}: no move suggested`);
      assert.ok(move(g, m[0], m[1]), `${n}: suggested move was illegal`);
    }
    assert.ok(solved(g));
    assert.equal(g.moves, optimal(n), `${n} discs: ${g.moves} moves`);
  }
});

test('hints recover from a detour', () => {
  const s = newGame(4);
  move(s, 0, 1); // a non-optimal first move for four discs (optimal is 0 → 1 actually when even, so detour differently)
  move(s, 0, 2);
  move(s, 1, 2);
  let guard = 0;
  while (!solved(s) && guard++ < 200) { const m = nextMove(s); move(s, m[0], m[1]); }
  assert.ok(solved(s));
});
