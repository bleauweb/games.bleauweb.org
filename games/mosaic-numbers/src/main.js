import { LEVELS, makePuzzle, isComplete, FILL, EMPTY, UNKNOWN } from './mosaic.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'mosaic-numbers.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let p = null;
let fill = null;
let mode = FILL;
let solved = false;
let drag = null;

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
  p = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  fill = Array.from({ length: p.n }, () => new Array(p.n).fill(UNKNOWN));
  solved = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `${p.n} × ${p.n}`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}
function satisfied(x, y) {
  const c = p.clues[y][x];
  if (c === null) return false;
  let filled = 0;
  let unknown = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = x + dx;
    const b = y + dy;
    if (a < 0 || b < 0 || a >= p.n || b >= p.n) continue;
    if (fill[b][a] === FILL) filled++;
    else if (fill[b][a] === UNKNOWN) unknown++;
  }
  return filled === c && unknown === 0;
}
function render() {
  const n = p.n;
  const px = Math.max(22, Math.min(44, Math.floor((Math.min(window.innerWidth, 560) - 30) / n) - 2));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  let html = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = fill[y][x];
    const c = p.clues[y][x];
    html += `<div class="cell ${v === FILL ? 'fill' : v === EMPTY ? 'x' : ''} ${c !== null && satisfied(x, y) ? 'sat' : ''}" data-x="${x}" data-y="${y}">${c === null ? '' : c}</div>`;
  }
  board.innerHTML = html;
  $('play-right').textContent = solved ? 'Done' : `${fill.flat().filter((v) => v === UNKNOWN).length} unknown`;
}
function setCell(x, y, v) {
  if (solved || fill[y][x] === v) return;
  fill[y][x] = v;
  sounds.click(v === FILL ? 880 : 520);
  if (fill.flat().every((c) => c !== UNKNOWN) && isComplete(fill, p.solution)) win();
  render();
}
function win() {
  solved = true;
  save.done[level.id] = (save.done[level.id] || 0) + 1;
  persist();
  $('feedback').textContent = p.name ? `Finished. It is a ${p.name}.` : 'Finished.';
  $('feedback').className = 'feedback ok pop';
  sounds.done();
}
const board = $('board');
function cellFrom(e) {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const c = t && t.closest ? t.closest('.cell') : null;
  return c ? [Number(c.dataset.x), Number(c.dataset.y)] : null;
}
board.addEventListener('pointerdown', (e) => {
  const c = cellFrom(e);
  if (!c) return;
  e.preventDefault();
  board.setPointerCapture?.(e.pointerId);
  const [x, y] = c;
  const v = fill[y][x] === mode ? UNKNOWN : mode;
  drag = { v };
  setCell(x, y, v);
});
board.addEventListener('pointermove', (e) => { if (!drag) return; const c = cellFrom(e); if (c) setCell(c[0], c[1], drag.v); });
const end = () => { drag = null; };
board.addEventListener('pointerup', end);
board.addEventListener('pointercancel', end);
$('mode-fill').addEventListener('click', () => { mode = FILL; $('mode-fill').classList.add('on'); $('mode-x').classList.remove('on'); });
$('mode-x').addEventListener('click', () => { mode = EMPTY; $('mode-x').classList.add('on'); $('mode-fill').classList.remove('on'); });
$('btn-check').addEventListener('click', () => {
  if (solved) return;
  let wrong = 0;
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
    const bad = (fill[y][x] === FILL && !p.solution[y][x]) || (fill[y][x] === EMPTY && p.solution[y][x]);
    board.querySelector(`[data-x="${x}"][data-y="${y}"]`).classList.toggle('wrong', bad);
    if (bad) wrong++;
  }
  $('feedback').textContent = wrong ? `${wrong} square${wrong === 1 ? '' : 's'} outlined do not match.` : 'Everything so far is right.';
  $('feedback').className = `feedback ${wrong ? 'hint' : 'ok'}`;
  setTimeout(() => board.querySelectorAll('.wrong').forEach((el) => el.classList.remove('wrong')), 2500);
});
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (p && !$('screen-play').classList.contains('hidden')) render(); });
renderTitle();
window.mosaicNumbers = { get puzzle() { return p; }, get fill() { return fill; }, setCell, start, LEVELS };
