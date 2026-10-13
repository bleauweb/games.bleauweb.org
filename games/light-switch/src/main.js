import { LEVELS, makePuzzle, press, allOff } from './lights.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'light-switch.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let puzzle = null;
let grid = null;
let moves = 0;
let solved = false;
let hintCells = [];

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

function start(lv, keep = false) {
  level = lv;
  if (!keep) puzzle = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  grid = puzzle.grid.map((r) => [...r]);
  // The remaining solution: cells from the generating set still to press.
  hintCells = puzzle.solution.map((c) => [...c]);
  moves = 0;
  solved = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `${lv.presses} presses made this board. It can be cleared in ${puzzle.solution.length}.`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}
function render() {
  const n = puzzle.n;
  const px = Math.max(40, Math.min(72, Math.floor((Math.min(window.innerWidth, 560) - 40) / n) - 8));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  let html = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) html += `<button class="light ${grid[y][x] ? 'on' : ''}" data-x="${x}" data-y="${y}" aria-label="light"></button>`;
  board.innerHTML = html;
  const lit = grid.flat().filter(Boolean).length;
  $('play-right').textContent = solved ? `Done in ${moves}` : `${lit} lit · ${moves} moves`;
}
$('board').addEventListener('click', (e) => {
  const b = e.target.closest('.light');
  if (!b || solved) return;
  const x = Number(b.dataset.x);
  const y = Number(b.dataset.y);
  press(grid, x, y);
  moves++;
  // Keep the hint set as the parity of presses relative to the generating set.
  const k = hintCells.findIndex(([a, c]) => a === x && c === y);
  if (k >= 0) hintCells.splice(k, 1);
  else hintCells.push([x, y]);
  sounds.click(grid[y][x] ? 760 : 440);
  if (allOff(grid)) {
    solved = true;
    save.done[level.id] = (save.done[level.id] || 0) + 1;
    persist();
    $('feedback').textContent = `All off in ${moves} move${moves === 1 ? '' : 's'}.`;
    $('feedback').className = 'feedback ok pop';
    sounds.done();
  }
  render();
});
$('btn-hint').addEventListener('click', () => {
  if (solved || !hintCells.length) return;
  const [x, y] = hintCells[0];
  const el = $('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
  el.classList.add('hint');
  $('feedback').textContent = 'The outlined light is one of the presses that clears the board.';
  $('feedback').className = 'feedback hint';
  setTimeout(() => el.classList.remove('hint'), 2500);
});
$('btn-restart').addEventListener('click', () => start(level, true));
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
renderTitle();
window.lightSwitch = { get puzzle() { return puzzle; }, get grid() { return grid; }, start, LEVELS };
