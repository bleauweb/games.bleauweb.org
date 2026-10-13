import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIECES, orientations, LEVELS, makePuzzle, fits, placementCovering, key, normalize } from '../games/tangram-fit/src/tangram.js';

test('orientations are distinct and bounded by eight', () => {
  for (const [name, cells] of Object.entries(PIECES)) {
    const ors = orientations(cells);
    assert.ok(ors.length >= 1 && ors.length <= 8, `${name}: ${ors.length}`);
    assert.equal(new Set(ors.map(key)).size, ors.length);
    for (const o of ors) assert.equal(o.length, cells.length);
  }
  assert.equal(orientations(PIECES.O4).length, 1);
  assert.equal(orientations(PIECES.I4).length, 2);
  assert.equal(orientations(PIECES.F5).length, 8);
});

test('every level builds puzzles whose solution exactly fills the silhouette with every piece', () => {
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 30; seed++) {
      const p = makePuzzle(level, seed);
      assert.equal(p.pieces.length, level.pieces);
      const placed = new Set();
      p.solution.forEach((cells, i) => {
        assert.equal(key(cells), key(normalize(cells)) && key(cells), `${level.id} seed ${seed}`); // sanity
        assert.ok(orientations(p.pieces[i].cells).some((o) => key(o) === key(cells)), `${level.id} seed ${seed}: piece ${i} is not an orientation of its shape`);
        assert.ok(fits(p, placed, cells), `${level.id} seed ${seed}: piece ${i} does not fit`);
        for (const c of cells) placed.add(c.join(','));
      });
      assert.equal(placed.size, p.silhouette.size, 'solution covers the silhouette exactly');
      assert.ok(p.w <= 10 && p.h <= 10);
      // Tapping any silhouette cell with the right orientation finds a placement for the first piece.
      const first = p.solution[0];
      const found = placementCovering(p, new Set(), normalize(first), first[0][0], first[0][1]);
      assert.ok(found);
    }
  }
});
