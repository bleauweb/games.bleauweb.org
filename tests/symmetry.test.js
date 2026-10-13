import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, LEVELS, orbit, isSource, complete, makePuzzle, check } from '../games/symmetry-studio/src/symmetry.js';

test('orbits are closed and completion is symmetric for every mode and size', () => {
  for (const mode of Object.keys(MODES)) {
    for (const n of [6, 7, 8, 11]) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const o = orbit(mode, n, x, y);
        for (const [a, b] of o) {
          assert.ok(a >= 0 && a < n && b >= 0 && b < n, `${mode} ${n}: orbit left the grid`);
          const back = orbit(mode, n, a, b).map((p) => p.join(','));
          assert.ok(back.includes(`${x},${y}`), `${mode} ${n}: orbit not closed`);
        }
      }
      const grid = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => ((x * 7 + y * 3) % 5) + 1));
      const full = complete(grid, mode);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) for (const [a, b] of orbit(mode, n, x, y)) assert.equal(full[b][a], full[y][x], `${mode} ${n}: not symmetric`);
    }
  }
});

test('source cells are a proper set of representatives', () => {
  for (const mode of Object.keys(MODES)) {
    const n = 8;
    let sources = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (isSource(mode, n, x, y)) sources++;
    const expected = { mirrorV: 32, mirrorH: 32, mirror4: 16, rot2: 32, rot4: 16, kaleido: 10 }[mode];
    assert.equal(sources, expected, `${mode}: ${sources} sources`);
  }
});

test('puzzles: the given cells plus symmetry equal the target, and only the target checks out', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 20; seed++) {
      const p = makePuzzle(level, seed);
      assert.deepEqual(complete(p.given, p.mode), p.target, `${level.id} seed ${seed}`);
      assert.ok(check(p.target, p.target).ok);
      assert.ok(p.toFill > 0);
      const wrong = p.target.map((r) => [...r]);
      wrong[p.n - 1][p.n - 1] = (wrong[p.n - 1][p.n - 1] % level.colors) + 1;
      assert.ok(!check(wrong, p.target).ok);
    }
  }
});
