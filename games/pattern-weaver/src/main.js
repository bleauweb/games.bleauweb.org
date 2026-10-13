import { PALETTE, MIRRORS, paint, fill, cycle, blank, seedPattern } from './weaver.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const KEY = 'pattern-weaver.save.v1';
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let n = 16;
let grid = blank(n);
let color = 0;
let mirror = 'none';
let tool = 'paint';
let tile = 0;
let history = [];
let drawing = false;
let gallery = loadGallery();

function loadGallery() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function saveGallery() { try { localStorage.setItem(KEY, JSON.stringify(gallery.slice(0, 40))); } catch { /* ignore */ } }

const canvas = $('canvas');
const ctx = canvas.getContext('2d');
function bg() { return getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#16213a'; }
function draw() {
  const size = 640;
  canvas.width = size;
  canvas.height = size;
  const c = size / n;
  ctx.fillStyle = bg();
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = grid[y][x];
    if (v !== null) { ctx.fillStyle = PALETTE[v]; ctx.fillRect(x * c + 1, y * c + 1, c - 2, c - 2); }
  }
  ctx.strokeStyle = 'rgba(128,128,128,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * c, 0); ctx.lineTo(i * c, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * c); ctx.lineTo(size, i * c); ctx.stroke(); }
  if (tile) {
    ctx.strokeStyle = 'rgba(90,160,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, tile * c - 2, tile * c - 2);
  }
}

function snapshot() { history.push(grid.map((r) => [...r])); if (history.length > 60) history.shift(); }
function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * n);
  const y = Math.floor(((e.clientY - r.top) / r.height) * n);
  return x >= 0 && y >= 0 && x < n && y < n ? [x, y] : null;
}
function apply(x, y) {
  const col = color === -1 ? null : color;
  if (tool === 'fill') fill(grid, x, y, col);
  else paint(grid, { x, y, color: col, mirror, tile });
  draw();
}
canvas.addEventListener('pointerdown', (e) => {
  const c = cellAt(e);
  if (!c) return;
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  snapshot();
  drawing = tool === 'paint';
  apply(...c);
  sounds.click(color === -1 ? 400 : 600 + color * 40);
});
canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const c = cellAt(e); if (c) apply(...c); });
const stop = () => { drawing = false; };
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);

function renderPalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  PALETTE.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = `swatch ${color === i ? 'on' : ''}`;
    b.style.background = p;
    b.addEventListener('click', () => { color = i; renderPalette(); sounds.tap(); });
    pal.append(b);
  });
  const e = document.createElement('button');
  e.className = `swatch erase ${color === -1 ? 'on' : ''}`;
  e.textContent = '·';
  e.addEventListener('click', () => { color = -1; renderPalette(); sounds.tap(); });
  pal.append(e);
}
function renderMirrors() {
  const box = $('mirrors');
  box.innerHTML = '';
  for (const [id, m] of Object.entries(MIRRORS)) {
    const b = document.createElement('button');
    b.className = `chip ${mirror === id ? 'on' : ''}`;
    b.textContent = m.name;
    b.addEventListener('click', () => { mirror = id; renderMirrors(); sounds.tap(); });
    box.append(b);
  }
  $('tool-paint').classList.toggle('on', tool === 'paint');
  $('tool-fill').classList.toggle('on', tool === 'fill');
}
$('tool-paint').addEventListener('click', () => { tool = 'paint'; renderMirrors(); });
$('tool-fill').addEventListener('click', () => { tool = 'fill'; renderMirrors(); });
$('tile').addEventListener('click', () => { tile = tile === 0 ? 4 : tile === 4 ? 8 : 0; $('tile').textContent = tile ? `Repeat: ${tile} × ${tile}` : 'Repeat: off'; $('tile').classList.toggle('on', tile > 0); draw(); });
$('size').addEventListener('click', () => {
  const next = n === 16 ? 24 : n === 24 ? 8 : 16;
  const g = blank(next);
  for (let y = 0; y < Math.min(n, next); y++) for (let x = 0; x < Math.min(n, next); x++) g[y][x] = grid[y][x];
  snapshot();
  n = next;
  grid = g;
  $('size').textContent = `${n} × ${n}`;
  draw();
});
$('undo').addEventListener('click', () => { if (history.length) { grid = history.pop(); n = grid.length; $('size').textContent = `${n} × ${n}`; draw(); } });
$('cycle').addEventListener('click', () => { snapshot(); cycle(grid, PALETTE.length); draw(); sounds.good(); });
$('seed').addEventListener('click', () => { snapshot(); grid = seedPattern(n); draw(); sounds.good(); });
$('clear').addEventListener('click', () => { snapshot(); grid = blank(n); draw(); });

function thumbCanvas(g) {
  const c = document.createElement('canvas');
  const s = 96;
  c.width = s; c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = bg();
  x.fillRect(0, 0, s, s);
  const k = s / g.length;
  g.forEach((row, y) => row.forEach((v, xx) => { if (v !== null) { x.fillStyle = PALETTE[v]; x.fillRect(xx * k, y * k, k, k); } }));
  return c;
}
function renderGallery() {
  const box = $('gallery');
  box.innerHTML = '';
  gallery.forEach((item, i) => {
    const d = document.createElement('div');
    d.className = 'thumb';
    d.append(thumbCanvas(item.grid));
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Remove';
    del.addEventListener('click', (e) => { e.stopPropagation(); gallery.splice(i, 1); saveGallery(); renderGallery(); });
    d.append(del);
    d.addEventListener('click', () => { snapshot(); grid = item.grid.map((r) => [...r]); n = grid.length; $('size').textContent = `${n} × ${n}`; draw(); sounds.tap(); });
    box.append(d);
  });
  $('gallery-count').textContent = gallery.length ? `${gallery.length} saved · tap one to load it` : 'nothing saved yet';
}
$('save').addEventListener('click', () => { gallery.unshift({ grid: grid.map((r) => [...r]), at: Date.now() }); saveGallery(); renderGallery(); sounds.done(); });
$('download').addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = 1024; out.height = 1024;
  const x = out.getContext('2d');
  x.fillStyle = bg();
  x.fillRect(0, 0, 1024, 1024);
  const k = 1024 / n;
  grid.forEach((row, y) => row.forEach((v, xx) => { if (v !== null) { x.fillStyle = PALETTE[v]; x.fillRect(xx * k, y * k, k, k); } }));
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = `pattern-${n}x${n}.png`;
  a.click();
});
calm = calmControls($('calm'), (c) => { calm = c; draw(); renderGallery(); });
renderPalette();
renderMirrors();
renderGallery();
draw();
window.patternWeaver = { get grid() { return grid; }, paintAt: (x, y) => { snapshot(); apply(x, y); }, setMirror: (m) => { mirror = m; renderMirrors(); }, setColor: (c) => { color = c; renderPalette(); } };
