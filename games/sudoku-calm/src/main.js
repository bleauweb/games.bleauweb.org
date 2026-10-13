import { LEVELS, makePuzzle, candidates, conflicts } from './sudoku.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'sudoku-calm.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let p = null;
let grid = null;
let notes = null;
let sel = null;
let notesMode = false;
let showCands = false;
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
  $('feedback').textContent = '';
  p = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  grid = p.givens.map((r) => [...r]);
  notes = Array.from({ length: lv.n }, () => Array.from({ length: lv.n }, () => new Set()));
  sel = null;
  solved = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `Boxes are ${lv.bw} wide and ${lv.bh} tall.`;
  $('feedback').className = 'feedback';
  render();
}
function render() {
  const n = p.n;
  const px = Math.max(30, Math.min(52, Math.floor((Math.min(window.innerWidth, 560) - 40) / n)));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  const selVal = sel ? grid[sel[1]][sel[0]] : 0;
  let html = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = grid[y][x];
    const given = !!p.givens[y][x];
    const cls = ['cell', given ? 'given' : '', (x + 1) % level.bw === 0 && x < n - 1 ? 'bx' : '', (y + 1) % level.bh === 0 && y < n - 1 ? 'by' : '', sel && sel[0] === x && sel[1] === y ? 'sel' : '', selVal && v === selVal ? 'same' : '', v && conflicts(level, grid, x, y) ? 'conflict' : ''].join(' ');
    let inner = v ? String(v) : '';
    if (!v) {
      const marks = showCands ? candidates(level, grid, x, y) : [...notes[y][x]];
      if (marks.length) inner = `<div class="notes">${Array.from({ length: n }, (_, k) => `<span>${marks.includes(k + 1) ? k + 1 : ''}</span>`).join('')}</div>`;
    }
    html += `<div class="${cls}" data-x="${x}" data-y="${y}">${inner}</div>`;
  }
  board.innerHTML = html;
  const pad = $('pad');
  pad.style.setProperty('--pad', Math.min(n, 9) + 1);
  const counts = {};
  for (const row of grid) for (const v of row) if (v) counts[v] = (counts[v] || 0) + 1;
  pad.innerHTML = Array.from({ length: n }, (_, k) => `<button data-v="${k + 1}" class="${counts[k + 1] >= n ? 'done' : ''}">${k + 1}</button>`).join('') + `<button data-v="0" class="clear">⌫</button>`;
  $('play-right').textContent = solved ? 'Done' : `${grid.flat().filter((v) => !v).length} empty`;
}
$('board').addEventListener('click', (e) => {
  const c = e.target.closest('.cell');
  if (!c) return;
  sel = [Number(c.dataset.x), Number(c.dataset.y)];
  sounds.tap();
  render();
});
$('pad').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !sel || solved) return;
  const [x, y] = sel;
  if (p.givens[y][x]) { sounds.gentle(); return; }
  const v = Number(b.dataset.v);
  if (notesMode && v) {
    if (notes[y][x].has(v)) notes[y][x].delete(v); else notes[y][x].add(v);
    grid[y][x] = 0;
  } else {
    grid[y][x] = v;
    if (v) notes[y][x].clear();
  }
  sounds.click(v ? 500 + v * 40 : 400);
  if (grid.flat().every(Boolean) && grid.every((r, yy) => r.every((val, xx) => val === p.solution[yy][xx]))) {
    solved = true;
    save.done[level.id] = (save.done[level.id] || 0) + 1;
    persist();
    $('feedback').textContent = 'Every row, column and box complete.';
    $('feedback').className = 'feedback ok pop';
    sounds.done();
  } else if (grid.flat().every(Boolean)) {
    $('feedback').textContent = 'Full, but some numbers clash (shown in red).';
    $('feedback').className = 'feedback hint';
  } else $('feedback').textContent = '';
  render();
});
$('btn-notes').addEventListener('click', () => { notesMode = !notesMode; $('btn-notes').textContent = `Notes: ${notesMode ? 'on' : 'off'}`; $('btn-notes').classList.toggle('on', notesMode); });
$('btn-cands').addEventListener('click', () => { showCands = !showCands; $('btn-cands').textContent = `Show options: ${showCands ? 'on' : 'off'}`; $('btn-cands').classList.toggle('on', showCands); render(); });
$('btn-hint').addEventListener('click', () => {
  if (solved) return;
  const n = p.n;
  // Prefer a naked single, explain it; otherwise reveal one correct cell.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (grid[y][x]) continue;
    const c = candidates(level, grid, x, y);
    if (c.length === 1) {
      grid[y][x] = c[0];
      sel = [x, y];
      $('feedback').textContent = `Only a ${c[0]} can go in that square: every other number is already in its row, column or box.`;
      $('feedback').className = 'feedback hint';
      render();
      return;
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (grid[y][x] !== p.solution[y][x]) {
      grid[y][x] = p.solution[y][x];
      sel = [x, y];
      $('feedback').textContent = `That square is a ${p.solution[y][x]}: it is the only place in its row, column or box where it fits.`;
      $('feedback').className = 'feedback hint';
      render();
      return;
    }
  }
});
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (p && !$('screen-play').classList.contains('hidden')) render(); });
renderTitle();
window.sudokuCalm = { get puzzle() { return p; }, get grid() { return grid; }, start, LEVELS, select(x, y) { sel = [x, y]; render(); } };
