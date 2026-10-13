import { LEVELS, makePuzzle, consistent, problems } from './binary.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'binary-grid.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let p = null;
let grid = null;
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
  p = makePuzzle(lv, Math.floor(Math.random() * 1e6));
  grid = p.givens.map((r) => [...r]);
  solved = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `${lv.n / 2} blue and ${lv.n / 2} orange in every row and column.`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}
function render() {
  const n = p.n;
  const px = Math.max(26, Math.min(52, Math.floor((Math.min(window.innerWidth, 560) - 40) / n) - 4));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('solved', solved);
  let html = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = grid[y][x];
    html += `<button class="cell ${v === 0 ? 'a' : v === 1 ? 'b' : ''} ${p.givens[y][x] !== -1 ? 'given' : ''}" data-x="${x}" data-y="${y}" aria-label="square"></button>`;
  }
  board.innerHTML = html;
  const left = grid.flat().filter((v) => v === -1).length;
  $('play-right').textContent = solved ? 'Done' : `${left} empty`;
}
$('board').addEventListener('click', (e) => {
  const b = e.target.closest('.cell');
  if (!b || solved) return;
  const x = Number(b.dataset.x);
  const y = Number(b.dataset.y);
  if (p.givens[y][x] !== -1) { sounds.gentle(); return; }
  grid[y][x] = grid[y][x] === -1 ? 0 : grid[y][x] === 0 ? 1 : -1;
  sounds.click(grid[y][x] === 0 ? 660 : grid[y][x] === 1 ? 520 : 400);
  if (grid.flat().every((v) => v !== -1)) {
    const ok = grid.every((r, yy) => r.every((v, xx) => v === p.solution[yy][xx]));
    if (ok) {
      solved = true;
      save.done[level.id] = (save.done[level.id] || 0) + 1;
      persist();
      $('feedback').textContent = 'All three rules hold. Finished.';
      $('feedback').className = 'feedback ok pop';
      sounds.done();
    } else {
      const probs = problems(grid);
      $('feedback').textContent = probs.length ? `Not yet: ${probs[0]}.` : 'Full, but two lines are identical somewhere. Try Check.';
      $('feedback').className = 'feedback hint';
    }
  } else $('feedback').textContent = '';
  render();
});
$('btn-check').addEventListener('click', () => {
  if (solved) return;
  let wrong = 0;
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
    const bad = grid[y][x] !== -1 && grid[y][x] !== p.solution[y][x];
    $('board').querySelector(`[data-x="${x}"][data-y="${y}"]`).classList.toggle('wrong', bad);
    if (bad) wrong++;
  }
  const probs = problems(grid);
  $('feedback').textContent = wrong ? `${wrong} square${wrong === 1 ? '' : 's'} outlined do not match the answer.${probs.length ? ` Also: ${probs[0]}.` : ''}` : consistent(grid) ? 'Everything so far is right.' : `Rule broken: ${probs[0]}.`;
  $('feedback').className = `feedback ${wrong ? 'hint' : 'ok'}`;
  setTimeout(() => $('board').querySelectorAll('.wrong').forEach((el) => el.classList.remove('wrong')), 2500);
});
$('btn-hint').addEventListener('click', () => {
  if (solved) return;
  for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) {
    if (grid[y][x] !== p.solution[y][x]) {
      grid[y][x] = p.solution[y][x];
      render();
      $('board').querySelector(`[data-x="${x}"][data-y="${y}"]`).classList.add('pop');
      return;
    }
  }
});
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (p && !$('screen-play').classList.contains('hidden')) render(); });
renderTitle();
window.binaryGrid = { get puzzle() { return p; }, get grid() { return grid; }, start, LEVELS };
