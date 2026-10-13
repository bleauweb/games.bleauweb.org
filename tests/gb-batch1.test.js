import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from './gb/harness.js';

test('stacks: 3 discs solved in 7 moves, record saved', () => {
  const g = boot('stacks');
  assert.ok(g.has('STACKS'));
  g.tap('START').tap('A'); // 3 discs
  assert.ok(g.has('Moves:'), g.text());
  let sel = 0;
  const go = (p) => { while (sel < p) { g.tap('RIGHT'); sel++; } while (sel > p) { g.tap('LEFT'); sel--; } };
  const mv = (a, b) => { go(a); g.tap('A'); go(b); g.tap('A'); };
  // optimal 3-disc solution from peg 0 to peg 2
  for (const [a, b] of [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]]) mv(a, b);
  assert.ok(g.has('Stacked!'), g.text());
  assert.ok(g.has('Moves:    7'), g.text());
  g.frames(20).tap('A');
  assert.equal(g.sram()[3] & 1, 1, 'level done bit');
  assert.equal(g.sram()[4], 7, 'best moves');
});

test('stacks: an illegal drop is refused and the hint names a move', () => {
  const g = boot('stacks');
  g.tap('START').tap('A');
  g.tap('A').tap('RIGHT').tap('A'); // small disc to peg 2
  g.tap('LEFT').tap('A').tap('RIGHT').tap('A'); // medium disc onto small: refused
  assert.ok(g.has('That disc is bigger.'), g.text());
  assert.equal(g.mem('cnt', 3).join(','), '1,1,0');
  g.tap('B'); // put it back
  assert.equal(g.mem('cnt', 3).join(','), '2,1,0');
  g.tap('SELECT');
  assert.ok(g.has('Try: peg'), g.text());
});

test('pairs: six cards, all pairs found, turns counted', () => {
  const g = boot('pairs');
  g.tap('START').tap('A');
  assert.ok(g.has('Left: 3'), g.text());
  const deck = g.mem('deck', 6);
  const cur = { x: 0, y: 0 };
  const at = (i) => g.moveTo(cur, i % 3, Math.floor(i / 3));
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    if (seen.has(i)) continue;
    const j = deck.findIndex((v, k) => k > i && v === deck[i]);
    at(i); g.tap('A'); at(j); g.tap('A'); seen.add(i); seen.add(j);
  }
  assert.ok(g.has('All pairs found!'), g.text());
  assert.ok(g.has('Turns:    3'), g.text());
});

test('pairs: a mismatch turns back after a moment', () => {
  const g = boot('pairs');
  g.tap('START').tap('A');
  const deck = g.mem('deck', 6);
  const j = deck.findIndex((v, k) => k > 0 && v !== deck[0]);
  g.tap('A');
  const cur = { x: 0, y: 0 }; g.moveTo(cur, j % 3, Math.floor(j / 3)); g.tap('A');
  assert.equal(g.mem('face', 6).filter((f) => f === 1).length, 2, 'two cards face up');
  g.until(() => g.mem('face', 6).filter((f) => f === 1).length === 0, 120);
  assert.equal(g.mem('left')[0], 3);
});

test('rhythm: mark the played pattern exactly and check', () => {
  const g = boot('rhythm-patterns');
  g.tap('START').tap('DOWN').tap('A'); // two lines, 8 steps
  g.frames(400); // let the playback finish
  const pat = [g.mem(g.sym('pat'), 8), g.mem(g.sym('pat') + 16, 8)];
  const cur = { x: 0, y: 0 };
  for (let r = 0; r < 2; r++) for (let s = 0; s < 8; s++) if (pat[r][s]) { g.moveTo(cur, s, r); g.tap('A'); }
  g.tap('B');
  assert.ok(g.has("That's the pattern!"), g.text());
});

test('rhythm: a wrong check shows what is extra and missing, and does not end the round', () => {
  const g = boot('rhythm-patterns');
  g.tap('START').tap('A');
  g.frames(300);
  const pat = g.mem('pat', 8);
  const wrong = pat.findIndex((v) => !v);
  const cur = { x: 0, y: 0 }; g.moveTo(cur, wrong, 0); g.tap('A').tap('B');
  assert.ok(g.has('X extra'), g.text());
  assert.ok(!g.has("That's the pattern!"));
});

test('weaver: mirror painting, shade cycling, save and load a slot', () => {
  const g = boot('pattern-weaver');
  g.tap('START');
  assert.ok(g.has('mirror  <->'), g.text());
  g.tap('RIGHT').tap('RIGHT').hold('A', 4).frames(10);
  const grid = g.mem('grid', 256);
  assert.equal(grid[2], 3); assert.equal(grid[13], 3, 'mirrored cell painted');
  g.tap('B'); // shade 0
  g.hold('A', 4).frames(10);
  assert.equal(g.mem('grid', 256)[2], 0, 'erased with shade 0');
  assert.equal(g.mem('grid', 256)[13], 0, 'mirror erased too');
  g.tap('B').tap('DOWN').hold('A', 4).frames(10); // shade 1 on the next row
  const saved = g.mem('grid', 256);
  assert.equal(saved[18], 1); assert.equal(saved[29], 1);
  g.tap('START'); // menu
  g.tap('DOWN').tap('DOWN').tap('DOWN').tap('DOWN').tap('A'); // save slot 1
  const sram = g.sram();
  assert.equal(sram[3 + 192], 1, 'slot 1 used bit');
  g.tap('START').tap('DOWN').tap('DOWN').tap('DOWN').tap('A'); // clear
  assert.equal(g.mem('grid', 256).reduce((a, b) => a + b, 0), 0);
  g.tap('START'); for (let i = 0; i < 7; i++) g.tap('DOWN'); g.tap('A'); // load slot 1
  assert.deepEqual(g.mem('grid', 256), saved, 'loaded back');
});
