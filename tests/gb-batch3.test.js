import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot } from './gb/harness.js';
const puzzles = (slug) => JSON.parse(fs.readFileSync(new URL(`../gameboy/games/${slug}/puzzles.json`, import.meta.url), 'utf8'));

test('number chain: follow the baked chain from 1 to the end', () => {
  const p = puzzles('number-chain')[0];
  const g = boot('number-chain');
  g.tap('START').tap('A');
  assert.equal(g.mem('n')[0], p.n);
  const where = {}; for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) where[p.solution[y][x]] = { x, y };
  const cur = { x: 0, y: 0 };
  g.moveTo(cur, where[1].x, where[1].y).tap('A');
  assert.equal(g.mem('sel')[0], 1);
  for (let v = 2; v <= p.n * p.n && !g.has('Chain complete!'); v++) {
    g.moveTo(cur, where[v].x, where[v].y).tap('A'); // places v, or selects it when it is a given
    if (!g.has('Chain complete!')) assert.equal(g.mem('sel')[0], v, `selected ${v}`);
  }
  assert.ok(g.has('Chain complete!'), g.text());
});

test('number chain: refuses a number that does not touch, and counting down works', () => {
  const p = puzzles('number-chain')[0];
  const g = boot('number-chain');
  g.tap('START').tap('A');
  const where = {}; for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) where[p.solution[y][x]] = { x, y };
  const cur = { x: 0, y: 0 };
  const last = p.n * p.n;
  g.moveTo(cur, where[last].x, where[last].y).tap('A'); // select the last number (always given)
  g.tap('SELECT'); // count down
  // a far-away empty square is refused
  let far = null; for (let y = 0; y < p.n && !far; y++) for (let x = 0; x < p.n; x++) if (!p.givens[y][x] && (Math.abs(x - where[last].x) > 1 || Math.abs(y - where[last].y) > 1)) { far = { x, y }; break; }
  g.moveTo(cur, far.x, far.y).tap('A');
  assert.ok(g.has('Not next to it.'), g.text());
  const prev = where[last - 1];
  if (!p.givens[prev.y][prev.x]) { g.moveTo(cur, prev.x, prev.y).tap('A'); assert.equal(g.mem(g.sym('cell') + prev.y * p.n + prev.x)[0], last - 1); }
});

test('symmetry studio: paint the target and win; the check counts wrong and empty', () => {
  const p = puzzles('symmetry-studio')[0];
  const g = boot('symmetry-studio');
  g.tap('START').tap('A');
  assert.equal(g.mem('n')[0], p.n);
  g.tap('SELECT');
  assert.ok(g.has('Wrong:  0'), g.text());
  const cur = { x: 0, y: 0 };
  const setInk = (v) => { let guard = 0; while (g.mem('ink')[0] !== v && guard++ < 10) g.tap('B'); assert.equal(g.mem('ink')[0], v); };
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
    if (p.source[y][x] || p.target[y][x] === 0) continue;
    setInk(p.target[y][x]); g.moveTo(cur, x, y).tap('A');
  }
  assert.ok(g.has('Perfectly balanced!'), g.text());
});

test('circuit paths: draw every baked path and win', () => {
  const p = puzzles('circuit-paths')[0];
  const g = boot('circuit-paths');
  g.tap('START').tap('A');
  assert.equal(g.mem('n')[0], p.n);
  const cur = { x: 0, y: 0 };
  for (const path of p.solution) {
    g.moveTo(cur, path[0][0], path[0][1]).tap('A');
    assert.notEqual(g.mem('drawing')[0], 0, 'drawing started');
    for (let i = 1; i < path.length; i++) g.moveTo(cur, path[i][0], path[i][1]);
    if (!g.has('All connected!')) assert.equal(g.mem('drawing')[0], 0, `path finished\n${g.text()}`);
  }
  assert.ok(g.has('All connected!'), g.text());
});

test('circuit paths: backtracking shortens the path and drawing over another trims it', () => {
  const p = puzzles('circuit-paths')[0];
  const g = boot('circuit-paths');
  g.tap('START').tap('A');
  const a = p.solution[0], b = p.solution[1];
  const cur = { x: 0, y: 0 };
  g.moveTo(cur, a[0][0], a[0][1]).tap('A');
  g.moveTo(cur, a[1][0], a[1][1]).moveTo(cur, a[2][0], a[2][1]);
  assert.equal(g.mem('plen')[0], 3);
  g.moveTo(cur, a[1][0], a[1][1]);
  assert.equal(g.mem('plen')[0], 2, 'backtracked');
  g.tap('B');
  assert.equal(g.mem('drawing')[0], 0);
  // draw pair 1 over pair 0's second cell if adjacent to its start
  const [bx, by] = b[0];
  const target = a[1];
  if (Math.abs(bx - target[0]) + Math.abs(by - target[1]) === 1) {
    g.moveTo(cur, bx, by).tap('A').moveTo(cur, target[0], target[1]);
    assert.equal(g.mem('plen')[0], 1, 'pair 0 trimmed back to its start');
    assert.equal(g.mem(g.sym('plen') + 1)[0], 2);
  }
});

test('tangram fit: place every piece as in the baked solution', () => {
  const { puzzles: ps } = puzzles('tangram-fit');
  const p = ps[0];
  const g = boot('tangram-fit');
  g.tap('START').tap('A');
  assert.equal(g.mem('npc')[0], p.pieces.length);
  const cur = { x: 0, y: 0 };
  const norm = (cells) => { const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1])); return cells.map(([x, y]) => [x - mx, y - my]); };
  const sameSet = (a, b) => a.length === b.length && a.every(([x, y]) => b.some(([u, v]) => u === x && v === y));
  const orient = () => { const o = g.mem('orient_n')[0], nc = g.mem('ncell')[0]; const base = g.sym('ocells') + o * 10; const m = g.mem(base, 10).map((v) => (v > 127 ? v - 256 : v)); const cells = []; for (let i = 0; i < nc; i++) cells.push([m[i * 2], m[i * 2 + 1]]); return cells; };
  for (let i = 0; i < p.pieces.length; i++) {
    let guard = 0; while (g.mem('cur')[0] !== i && guard++ < 10) g.tap('SELECT');
    assert.equal(g.mem('cur')[0], i);
    const want = norm(p.solution[i]);
    guard = 0; while (!sameSet(orient(), want) && guard++ < 8) g.tap('B');
    assert.ok(sameSet(orient(), want), `orientation for piece ${i}`);
    const mx = Math.min(...p.solution[i].map((c) => c[0])), my = Math.min(...p.solution[i].map((c) => c[1]));
    const o = orient();
    g.moveTo(cur, mx + o[0][0], my + o[0][1]).tap('A');
    assert.equal(g.mem(g.sym('placed') + i)[0], 1, `piece ${i} placed\n${g.text()}`);
  }
  assert.ok(g.has('A perfect fit!'), g.text());
});
