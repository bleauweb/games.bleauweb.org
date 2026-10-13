import { LEVELS, makePuzzle, matches, FILL, EMPTY, UNKNOWN, lineClues } from './nonogram.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'tile-logic.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let puzzle = null;
let fill = null;
let mode = FILL;
let solved = false;
let drag = null;

function load() { try { return { solvedCount: {}, next: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { solvedCount: {}, next: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const n = save.solvedCount[lv.id] || 0;
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${lv.tip}</div></div>${n ? `<span class="done">✓ ${n}</span>` : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv, fresh = false) {
  level = lv;
  const seedKey = lv.id;
  if (fresh || !save.next[seedKey]) save.next[seedKey] = Math.floor(Math.random() * 1e6);
  puzzle = makePuzzle(lv, save.next[seedKey]);
  fill = Array.from({ length: puzzle.size }, () => new Array(puzzle.size).fill(UNKNOWN));
  solved = false;
  persist();
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `${puzzle.size} × ${puzzle.size}`;
  $('play-right').textContent = `${save.solvedCount[lv.id] || 0} solved`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  renderBoard();
}

function cellPx() {
  const n = puzzle.size;
  const maxClue = Math.max(...puzzle.rows.map((r) => r.length));
  const avail = Math.min(window.innerWidth, 560) - 24;
  return Math.max(18, Math.min(34, Math.floor(avail / (n + maxClue * 0.9 + 1))));
}

function renderBoard() {
  const n = puzzle.size;
  const px = cellPx();
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.setProperty('--clue-font', `${Math.max(10, Math.round(px * 0.5))}px`);
  board.style.gridTemplateColumns = `auto repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  let html = '<div class="corner"></div>';
  for (let x = 0; x < n; x++) html += `<div class="clue col ${colDone(x) ? 'done' : ''}" data-col="${x}">${puzzle.cols[x].map((c) => `<span>${c}</span>`).join('')}</div>`;
  for (let y = 0; y < n; y++) {
    html += `<div class="clue ${rowDone(y) ? 'done' : ''}" data-row="${y}">${puzzle.rows[y].map((c) => `<span>${c}</span>`).join('')}</div>`;
    for (let x = 0; x < n; x++) {
      const v = fill[y][x];
      html += `<div class="cell ${v === FILL ? 'fill' : v === EMPTY ? 'x' : ''} ${(x + 1) % 5 === 0 && x < n - 1 ? 'r5' : ''} ${(y + 1) % 5 === 0 && y < n - 1 ? 'b5' : ''}" data-x="${x}" data-y="${y}"></div>`;
    }
  }
  board.innerHTML = html;
}
function rowDone(y) { return JSON.stringify(lineClues(fill[y].map((c) => (c === FILL ? 1 : 0)))) === JSON.stringify(puzzle.rows[y]); }
function colDone(x) { return JSON.stringify(lineClues(fill.map((r) => (r[x] === FILL ? 1 : 0)))) === JSON.stringify(puzzle.cols[x]); }

function setCell(x, y, v) {
  if (solved) return;
  if (fill[y][x] === v) return;
  fill[y][x] = v;
  const el = $('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
  el.className = `cell ${v === FILL ? 'fill' : v === EMPTY ? 'x' : ''} ${(x + 1) % 5 === 0 && x < puzzle.size - 1 ? 'r5' : ''} ${(y + 1) % 5 === 0 && y < puzzle.size - 1 ? 'b5' : ''}`;
  $('board').querySelector(`[data-row="${y}"]`).classList.toggle('done', rowDone(y));
  $('board').querySelector(`[data-col="${x}"]`).classList.toggle('done', colDone(x));
  sounds.click(v === FILL ? 880 : 520);
  if (matches(fill, puzzle.rows, puzzle.cols)) win();
}

function win() {
  solved = true;
  save.solvedCount[level.id] = (save.solvedCount[level.id] || 0) + 1;
  delete save.next[level.id];
  persist();
  $('board').classList.add('solved');
  $('feedback').textContent = puzzle.name ? `Solved! It is a ${puzzle.name}.` : 'Solved!';
  $('feedback').className = 'feedback ok pop';
  $('play-right').textContent = `${save.solvedCount[level.id]} solved`;
  sounds.done();
}

const board = $('board');
function cellFrom(e) {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const c = t && t.closest ? t.closest('.cell') : null;
  return c ? { x: Number(c.dataset.x), y: Number(c.dataset.y) } : null;
}
board.addEventListener('pointerdown', (e) => {
  const c = cellFrom(e);
  if (!c) return;
  e.preventDefault();
  board.setPointerCapture?.(e.pointerId);
  const cur = fill[c.y][c.x];
  // Tap on the same state clears; otherwise set to the current mode. Drag applies the same value.
  const v = cur === mode ? UNKNOWN : mode;
  drag = { v, axis: null, x0: c.x, y0: c.y };
  setCell(c.x, c.y, v);
});
board.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const c = cellFrom(e);
  if (!c) return;
  if (!drag.axis && (c.x !== drag.x0 || c.y !== drag.y0)) drag.axis = Math.abs(c.x - drag.x0) >= Math.abs(c.y - drag.y0) ? 'x' : 'y';
  const x = drag.axis === 'y' ? drag.x0 : c.x;
  const y = drag.axis === 'x' ? drag.y0 : c.y;
  setCell(x, y, drag.v);
});
const endDrag = () => { drag = null; };
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);

$('mode-fill').addEventListener('click', () => { mode = FILL; $('mode-fill').classList.add('on'); $('mode-x').classList.remove('on'); });
$('mode-x').addEventListener('click', () => { mode = EMPTY; $('mode-x').classList.add('on'); $('mode-fill').classList.remove('on'); });
$('btn-check').addEventListener('click', () => {
  if (solved) return;
  let wrong = 0;
  for (let y = 0; y < puzzle.size; y++) for (let x = 0; x < puzzle.size; x++) {
    const el = board.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    const bad = (fill[y][x] === FILL && !puzzle.solution[y][x]) || (fill[y][x] === EMPTY && puzzle.solution[y][x]);
    el.classList.toggle('wrong', bad);
    if (bad) wrong++;
  }
  $('feedback').textContent = wrong ? `${wrong} square${wrong === 1 ? '' : 's'} marked in red do not match.` : 'Everything so far is right.';
  $('feedback').className = `feedback ${wrong ? 'hint' : 'ok'}`;
  setTimeout(() => board.querySelectorAll('.wrong').forEach((el) => el.classList.remove('wrong')), 2500);
});
$('btn-new').addEventListener('click', () => start(level, true));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (puzzle && !$('screen-play').classList.contains('hidden')) renderBoard(); });
renderTitle();
window.tileLogic = { get puzzle() { return puzzle; }, get fill() { return fill; }, setCell, start, LEVELS };
