import { LEVELS, makePuzzle, orientations, placementCovering, key, normalize } from './tangram.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'tangram-fit.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let puzzle = null;
let placed = []; // per piece: absolute cells or null
let orient = []; // per piece: index into its orientation list
let ors = [];
let selected = null;
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
  ors = puzzle.pieces.map((p) => orientations(p.cells));
  placed = puzzle.pieces.map(() => null);
  orient = puzzle.pieces.map(() => 0);
  selected = 0;
  solved = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `${puzzle.pieces.length} pieces · ${puzzle.silhouette.size} squares`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}

function placedSet() {
  const s = new Set();
  placed.forEach((cells) => { if (cells) for (const c of cells) s.add(c.join(',')); });
  return s;
}

function pieceSvg(cells, color) {
  const n = normalize(cells);
  const w = Math.max(...n.map((c) => c[0])) + 1;
  const h = Math.max(...n.map((c) => c[1])) + 1;
  const size = Math.max(w, h, 3);
  return `<svg viewBox="0 0 ${size} ${size}">${n.map(([x, y]) => `<rect x="${x + (size - w) / 2 + 0.06}" y="${y + (size - h) / 2 + 0.06}" width="0.88" height="0.88" rx="0.12" fill="${color}"/>`).join('')}</svg>`;
}

function render() {
  const px = Math.max(22, Math.min(44, Math.floor((Math.min(window.innerWidth, 560) - 30) / Math.max(puzzle.w, puzzle.h)) - 2));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.gridTemplateColumns = `repeat(${puzzle.w}, ${px}px)`;
  board.classList.toggle('solved', solved);
  const owner = new Map();
  placed.forEach((cells, i) => { if (cells) for (const c of cells) owner.set(c.join(','), i); });
  let html = '';
  for (let y = 0; y < puzzle.h; y++) for (let x = 0; x < puzzle.w; x++) {
    const k = `${x},${y}`;
    const sil = puzzle.silhouette.has(k);
    const o = owner.get(k);
    html += `<div class="cell ${sil ? 'sil' : ''} ${o !== undefined ? 'filled' : ''}" data-x="${x}" data-y="${y}" style="${o !== undefined ? `background:${puzzle.pieces[o].color}` : ''}"></div>`;
  }
  board.innerHTML = html;
  const tray = $('tray');
  tray.innerHTML = '';
  puzzle.pieces.forEach((p, i) => {
    if (placed[i]) return;
    const b = document.createElement('button');
    b.className = `piece ${selected === i ? 'on' : ''}`;
    b.innerHTML = pieceSvg(ors[i][orient[i]], p.color);
    b.addEventListener('click', () => { selected = i; sounds.tap(); render(); });
    tray.append(b);
  });
  if (!tray.children.length && !solved) tray.innerHTML = '<span class="muted small">Everything is placed.</span>';
  const left = placed.filter((c) => !c).length;
  $('play-right').textContent = solved ? 'Fits!' : `${left} to place`;
}

$('board').addEventListener('click', (e) => {
  const c = e.target.closest('.cell');
  if (!c || solved) return;
  const x = Number(c.dataset.x);
  const y = Number(c.dataset.y);
  const k = `${x},${y}`;
  // Pick a placed piece back up.
  const ownerIdx = placed.findIndex((cells) => cells && cells.some((cc) => cc.join(',') === k));
  if (ownerIdx >= 0) {
    placed[ownerIdx] = null;
    selected = ownerIdx;
    sounds.tap();
    render();
    return;
  }
  if (selected === null || placed[selected] || !puzzle.silhouette.has(k)) return;
  const shape = ors[selected][orient[selected]];
  const cells = placementCovering(puzzle, placedSet(), shape, x, y);
  if (!cells) {
    $('feedback').textContent = 'That piece does not fit there in this orientation. Try turning it, or another square.';
    $('feedback').className = 'feedback hint';
    sounds.gentle();
    return;
  }
  placed[selected] = cells;
  $('feedback').textContent = '';
  sounds.good();
  const next = placed.findIndex((p) => !p);
  selected = next >= 0 ? next : null;
  if (next < 0) win();
  render();
});

function win() {
  solved = true;
  save.done[level.id] = (save.done[level.id] || 0) + 1;
  persist();
  $('feedback').textContent = 'A perfect fit.';
  $('feedback').className = 'feedback ok pop';
  sounds.done();
}
$('btn-rot').addEventListener('click', () => { if (selected === null) return; orient[selected] = (orient[selected] + 1) % ors[selected].length; sounds.tap(); render(); });
$('btn-flip').addEventListener('click', () => {
  if (selected === null) return;
  const cur = ors[selected][orient[selected]];
  const flipped = key(normalize(cur.map(([x, y]) => [-x, y])));
  const idx = ors[selected].findIndex((o) => key(o) === flipped);
  if (idx >= 0) orient[selected] = idx;
  sounds.tap();
  render();
});
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (puzzle && !$('screen-play').classList.contains('hidden')) render(); });
renderTitle();
window.tangramFit = { get puzzle() { return puzzle; }, get placed() { return placed; }, start, LEVELS, place(i, cells) { placed[i] = cells; if (placed.every(Boolean)) win(); render(); } };
