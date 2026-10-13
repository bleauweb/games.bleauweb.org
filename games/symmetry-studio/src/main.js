import { LEVELS, MODES, PALETTE, makePuzzle, check, isSource } from './symmetry.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'symmetry-studio.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let puzzle = null;
let grid = null;
let color = 1;
let solved = false;

function load() { try { return { solved: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { solved: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const n = save.solved[lv.id] || 0;
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${MODES[lv.mode].tip} ${lv.colors} colours.</div></div>${n ? `<span class="done">✓ ${n}</span>` : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv) {
  level = lv;
  puzzle = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  grid = puzzle.given.map((r) => [...r]);
  solved = false;
  color = 1;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = MODES[lv.mode].name;
  $('play-sub').textContent = MODES[lv.mode].tip;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  renderPalette();
  renderBoard();
  updateCount();
}

function cellPx() {
  const avail = Math.min(window.innerWidth, 560) - 30;
  return Math.max(22, Math.min(44, Math.floor(avail / puzzle.n) - 3));
}

function renderBoard() {
  const n = puzzle.n;
  const px = cellPx();
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  let html = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const given = isSource(puzzle.mode, n, x, y);
    const v = grid[y][x];
    html += `<div class="cell ${given ? 'given' : ''} ${given && !v ? 'blank' : ''}" data-x="${x}" data-y="${y}" style="${v ? `background:${PALETTE[v - 1]}` : ''}"></div>`;
  }
  // Axis guides.
  const total = n * (px + 3) + 3;
  const mid = total / 2;
  const line = (style) => `<div class="axis" style="${style}"></div>`;
  const m = puzzle.mode;
  if (m === 'mirrorV' || m === 'mirror4' || m === 'kaleido') html += line(`left:${mid - 1}px;top:0;width:2px;height:${total}px`);
  if (m === 'mirrorH' || m === 'mirror4' || m === 'kaleido') html += line(`top:${mid - 1}px;left:0;height:2px;width:${total}px`);
  if (m === 'rot2' || m === 'rot4') html += `<div class="axis" style="left:${mid - 5}px;top:${mid - 5}px;width:10px;height:10px;border-radius:50%"></div>`;
  if (m === 'kaleido') {
    html += line(`left:${mid - 1}px;top:0;width:2px;height:${total}px;transform:rotate(45deg);transform-origin:center`);
    html += line(`left:${mid - 1}px;top:0;width:2px;height:${total}px;transform:rotate(-45deg);transform-origin:center`);
  }
  board.innerHTML = html;
}

function renderPalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  for (let i = 1; i <= puzzle.colors; i++) {
    const b = document.createElement('button');
    b.className = `swatch ${color === i ? 'on' : ''}`;
    b.style.background = PALETTE[i - 1];
    b.addEventListener('click', () => { color = i; renderPalette(); sounds.tap(); });
    pal.append(b);
  }
  const blank = document.createElement('button');
  blank.className = `swatch blank ${color === 0 ? 'on' : ''}`;
  blank.textContent = '·';
  blank.addEventListener('click', () => { color = 0; renderPalette(); sounds.tap(); });
  pal.append(blank);
}

function updateCount() {
  const n = puzzle.n;
  let left = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!isSource(puzzle.mode, n, x, y) && grid[y][x] !== puzzle.target[y][x]) left++;
  $('play-right').textContent = solved ? 'Done' : `${left} to fix`;
  return left;
}

$('board').addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.cell');
  if (!c || solved) return;
  const x = Number(c.dataset.x);
  const y = Number(c.dataset.y);
  if (isSource(puzzle.mode, puzzle.n, x, y)) { sounds.gentle(); return; }
  grid[y][x] = color;
  c.style.background = color ? PALETTE[color - 1] : '';
  sounds.click(color ? 700 + color * 60 : 400);
  const left = updateCount();
  if (left === 0 && check(grid, puzzle.target).ok) win();
});

function win() {
  solved = true;
  save.solved[level.id] = (save.solved[level.id] || 0) + 1;
  persist();
  $('board').classList.add('solved');
  $('feedback').textContent = 'Symmetric. Finished.';
  $('feedback').className = 'feedback ok pop';
  updateCount();
  sounds.done();
}

$('btn-hint').addEventListener('click', () => {
  if (solved) return;
  const n = puzzle.n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!isSource(puzzle.mode, n, x, y) && grid[y][x] !== puzzle.target[y][x]) {
      grid[y][x] = puzzle.target[y][x];
      const c = $('board').querySelector(`[data-x="${x}"][data-y="${y}"]`);
      c.style.background = grid[y][x] ? PALETTE[grid[y][x] - 1] : '';
      c.classList.add('pop');
      const left = updateCount();
      if (left === 0) win();
      return;
    }
  }
});
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (puzzle && !$('screen-play').classList.contains('hidden')) renderBoard(); });
renderTitle();
window.symmetryStudio = { get puzzle() { return puzzle; }, get grid() { return grid; }, start, LEVELS, setColor: (c) => { color = c; } };
