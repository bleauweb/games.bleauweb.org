import { LEVELS, makePuzzle, isComplete } from './chain.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'number-chain.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let p = null;
let grid = null;
let sel = null; // [x, y] of the number we are counting from
let dir = 1;
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
  $('feedback').textContent = 'Making a puzzle…';
  p = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  grid = p.givens.map((r) => [...r]);
  sel = null;
  solved = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `1 to ${lv.n * lv.n}. Tap a number, then the squares after it.`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}
function render() {
  const n = p.n;
  const px = Math.max(36, Math.min(64, Math.floor((Math.min(window.innerWidth, 560) - 40) / n) - 4));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  let html = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = grid[y][x];
    const given = !!p.givens[y][x];
    const isSel = sel && sel[0] === x && sel[1] === y;
    html += `<button class="cell ${given ? 'given' : v ? 'filled' : ''} ${isSel ? 'sel' : ''}" data-x="${x}" data-y="${y}">${v || ''}</button>`;
  }
  board.innerHTML = html;
  const left = grid.flat().filter((v) => !v).length;
  $('play-right').textContent = solved ? 'Done' : `${left} empty`;
}
function used(v) {
  return grid.some((r) => r.includes(v));
}
$('board').addEventListener('click', (e) => {
  const b = e.target.closest('.cell');
  if (!b || solved) return;
  const x = Number(b.dataset.x);
  const y = Number(b.dataset.y);
  const v = grid[y][x];
  if (v) {
    if (sel && sel[0] === x && sel[1] === y) {
      // Second tap on a filled, non-given cell clears it.
      if (!p.givens[y][x]) { grid[y][x] = 0; sel = null; sounds.click(400); }
      else sel = null;
    } else { sel = [x, y]; sounds.tap(); }
    render();
    return;
  }
  if (!sel) { $('feedback').textContent = 'Tap a number first, then the empty square next to it.'; $('feedback').className = 'feedback hint'; return; }
  const [sx, sy] = sel;
  if (Math.abs(sx - x) + Math.abs(sy - y) !== 1) { $('feedback').textContent = 'That square is not next to the number you chose.'; $('feedback').className = 'feedback hint'; sounds.gentle(); return; }
  const next = grid[sy][sx] + dir;
  if (next < 1 || next > p.n * p.n) { $('feedback').textContent = 'The chain ends there.'; $('feedback').className = 'feedback hint'; return; }
  if (used(next)) { $('feedback').textContent = `${next} is already on the board.`; $('feedback').className = 'feedback hint'; sounds.gentle(); return; }
  grid[y][x] = next;
  sel = [x, y];
  $('feedback').textContent = '';
  sounds.click(500 + (next % 12) * 30);
  if (grid.flat().every(Boolean)) {
    if (isComplete(grid, p.solution)) {
      solved = true;
      sel = null;
      save.done[level.id] = (save.done[level.id] || 0) + 1;
      persist();
      $('feedback').textContent = 'The chain is complete.';
      $('feedback').className = 'feedback ok pop';
      sounds.done();
    } else {
      $('feedback').textContent = 'Full, but something is out of place. Try Check.';
      $('feedback').className = 'feedback hint';
    }
  }
  render();
});
$('btn-check').addEventListener('click', () => {
  if (solved) return;
  let wrong = 0;
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
    const el = $('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
    const bad = grid[y][x] && grid[y][x] !== p.solution[y][x];
    el.classList.toggle('wrong', !!bad);
    if (bad) wrong++;
  }
  $('feedback').textContent = wrong ? `${wrong} number${wrong === 1 ? ' is' : 's are'} in the wrong place (outlined).` : 'Everything so far is right.';
  $('feedback').className = `feedback ${wrong ? 'hint' : 'ok'}`;
  setTimeout(() => $('board').querySelectorAll('.wrong').forEach((el) => el.classList.remove('wrong')), 2500);
});
$('dir-up').addEventListener('click', () => { dir = 1; $('dir-up').classList.add('on'); $('dir-down').classList.remove('on'); });
$('dir-down').addEventListener('click', () => { dir = -1; $('dir-down').classList.add('on'); $('dir-up').classList.remove('on'); });
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (p && !$('screen-play').classList.contains('hidden')) render(); });
renderTitle();
window.numberChain = { get puzzle() { return p; }, get grid() { return grid; }, start, LEVELS, setGrid(g) { grid = g; render(); } };
