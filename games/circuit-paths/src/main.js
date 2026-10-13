import { LEVELS, makePuzzle, isSolved } from './paths.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'circuit-paths.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let puzzle = null;
let paths = []; // per pair: list of [x, y]
let drawing = null; // { i, path }
let solved = false;

function load() { try { return { done: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { done: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const n = save.done[lv.id] || 0;
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${lv.tip}</div></div>${n ? `<span class="done">✓ ${n}</span>` : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv) {
  level = lv;
  puzzle = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  paths = puzzle.pairs.map(() => []);
  solved = false;
  drawing = null;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `${puzzle.pairs.length} pairs`;
  $('play-right').textContent = `${save.done[lv.id] || 0} done`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('board').classList.remove('solved');
  render();
}

function render() {
  const n = puzzle.n;
  const svg = $('board');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  let html = '';
  for (let i = 0; i <= n; i++) html += `<line class="gridline" x1="${i}" y1="0" x2="${i}" y2="${n}"/><line class="gridline" x1="0" y1="${i}" x2="${n}" y2="${i}"/>`;
  paths.forEach((p, i) => {
    const c = puzzle.pairs[i].color;
    for (const [x, y] of p) html += `<rect class="fillcell" x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    if (p.length >= 2) html += `<polyline class="path" stroke="${c}" points="${p.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ')}"/>`;
  });
  puzzle.pairs.forEach((q) => {
    for (const [x, y] of [q.a, q.b]) html += `<circle class="dot" cx="${x + 0.5}" cy="${y + 0.5}" r="0.32" fill="${q.color}"/>`;
  });
  svg.innerHTML = html;
  const connected = paths.filter((p, i) => p.length >= 2 && endsOf(i)).length;
  $('play-right').textContent = solved ? 'Complete' : `${connected} / ${puzzle.pairs.length} joined`;
}
function endsOf(i) {
  const p = paths[i];
  const q = puzzle.pairs[i];
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
  const f = p[0];
  const l = p[p.length - 1];
  return (eq(f, q.a) && eq(l, q.b)) || (eq(f, q.b) && eq(l, q.a));
}

function cellAt(e) {
  const svg = $('board');
  const r = svg.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * puzzle.n);
  const y = Math.floor(((e.clientY - r.top) / r.height) * puzzle.n);
  if (x < 0 || y < 0 || x >= puzzle.n || y >= puzzle.n) return null;
  return [x, y];
}
function pairAt(cell) {
  return puzzle.pairs.findIndex((q) => (q.a[0] === cell[0] && q.a[1] === cell[1]) || (q.b[0] === cell[0] && q.b[1] === cell[1]));
}
function ownerOf(cell) {
  for (let i = 0; i < paths.length; i++) {
    const k = paths[i].findIndex(([x, y]) => x === cell[0] && y === cell[1]);
    if (k >= 0) return { i, k };
  }
  return null;
}

const svg = $('board');
svg.addEventListener('pointerdown', (e) => {
  if (solved) return;
  const cell = cellAt(e);
  if (!cell) return;
  e.preventDefault();
  svg.setPointerCapture?.(e.pointerId);
  const pi = pairAt(cell);
  const own = ownerOf(cell);
  if (pi >= 0) {
    // Start fresh from an endpoint.
    paths[pi] = [cell];
    drawing = { i: pi };
  } else if (own) {
    // Continue an existing path from this cell (trim what came after).
    paths[own.i] = paths[own.i].slice(0, own.k + 1);
    drawing = { i: own.i };
  } else return;
  sounds.tap();
  render();
});
svg.addEventListener('pointermove', (e) => {
  if (!drawing || solved) return;
  const cell = cellAt(e);
  if (!cell) return;
  const p = paths[drawing.i];
  const last = p[p.length - 1];
  if (last[0] === cell[0] && last[1] === cell[1]) return;
  // Only step to a 4-neighbour; if the pointer jumped, ignore until it comes back adjacent.
  if (Math.abs(last[0] - cell[0]) + Math.abs(last[1] - cell[1]) !== 1) return;
  // Backtracking onto our own previous cell shortens the path.
  const prevIdx = p.findIndex(([x, y]) => x === cell[0] && y === cell[1]);
  if (prevIdx >= 0) { paths[drawing.i] = p.slice(0, prevIdx + 1); render(); return; }
  // A path is finished at its other endpoint; do not run past it.
  const q = puzzle.pairs[drawing.i];
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
  if (eq(last, q.a) && p.length > 1 || eq(last, q.b) && p.length > 1) return;
  // Other colours' endpoints are walls; other paths get trimmed from this cell on.
  const otherPair = pairAt(cell);
  if (otherPair >= 0 && otherPair !== drawing.i) return;
  const own = ownerOf(cell);
  if (own && own.i !== drawing.i) paths[own.i] = paths[own.i].slice(0, own.k);
  p.push(cell);
  sounds.click(500 + drawing.i * 40);
  render();
  if (isSolved(puzzle.n, puzzle.pairs, paths)) win();
});
const end = () => { drawing = null; };
svg.addEventListener('pointerup', end);
svg.addEventListener('pointercancel', end);

function win() {
  solved = true;
  drawing = null;
  save.done[level.id] = (save.done[level.id] || 0) + 1;
  persist();
  svg.classList.add('solved');
  $('feedback').textContent = 'Circuit complete.';
  $('feedback').className = 'feedback ok pop';
  render();
  sounds.done();
}
$('btn-clear').addEventListener('click', () => { if (solved) return; paths = puzzle.pairs.map(() => []); render(); });
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
renderTitle();
window.circuitPaths = { get puzzle() { return puzzle; }, get paths() { return paths; }, setPaths(p) { paths = p; render(); if (isSolved(puzzle.n, puzzle.pairs, paths)) win(); }, start, LEVELS };
