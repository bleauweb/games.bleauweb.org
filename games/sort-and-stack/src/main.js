import { LEVELS, makePuzzle, COLORS } from './sorting.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'sort-and-stack.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let p = null;
let placed = new Map(); // item id -> bin
let selected = null;
let misses = 0;

function load() { try { return { done: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { done: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

export function itemSvg(it) {
  const c = COLORS[it.color];
  const r = it.size === 'small' ? 11 : 18;
  const fill = it.fill === 'solid' ? c : 'none';
  const stroke = `stroke="${c}" stroke-width="4"`;
  let body;
  if (it.shape === 'circle') body = `<circle cx="24" cy="24" r="${r}" fill="${fill}" ${stroke}/>`;
  else if (it.shape === 'square') body = `<rect x="${24 - r}" y="${24 - r}" width="${2 * r}" height="${2 * r}" rx="3" fill="${fill}" ${stroke}/>`;
  else if (it.shape === 'triangle') body = `<polygon points="24,${24 - r * 1.1} ${24 + r},${24 + r * 0.8} ${24 - r},${24 + r * 0.8}" fill="${fill}" ${stroke} stroke-linejoin="round"/>`;
  else {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.5 : r * 1.05; pts.push(`${24 + rr * Math.cos(a)},${24 + rr * Math.sin(a)}`); }
    body = `<polygon points="${pts.join(' ')}" fill="${fill}" ${stroke} stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 48 48">${body}</svg>`;
}

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
  placed = new Map();
  for (const id of p.examples) placed.set(id, p.items.find((it) => it.id === id).bin);
  selected = null;
  misses = 0;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = p.labelled ? 'The bins are labelled. Sort everything.' : 'No labels: the examples in each bin show the rule.';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  show($('explain'), false);
  render();
}

function render() {
  const bins = $('bins');
  bins.style.setProperty('--bins', p.bins.length);
  bins.innerHTML = p.bins.map((b, i) => {
    const inside = p.items.filter((it) => placed.get(it.id) === i);
    const full = p.items.filter((it) => it.bin === i).length === inside.length;
    return `<div class="bin ${full ? 'full' : ''} ${selected !== null ? 'target' : ''}" data-bin="${i}"><div class="label">${b.label}</div><div class="stack">${inside.map((it) => `<div class="item ${p.examples.includes(it.id) ? 'ex' : ''}">${itemSvg(it)}</div>`).join('')}</div></div>`;
  }).join('');
  const tray = $('tray');
  const left = p.items.filter((it) => !placed.has(it.id));
  tray.innerHTML = left.map((it) => `<button class="item ${selected === it.id ? 'on' : ''}" data-item="${it.id}">${itemSvg(it)}</button>`).join('') || '<span class="muted small">All sorted.</span>';
  $('play-right').textContent = `${left.length} left`;
}

$('tray').addEventListener('click', (e) => {
  const b = e.target.closest('[data-item]');
  if (!b) return;
  selected = selected === Number(b.dataset.item) ? null : Number(b.dataset.item);
  sounds.tap();
  render();
});
$('bins').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bin]');
  if (!b || selected === null) return;
  const bin = Number(b.dataset.bin);
  const it = p.items.find((x) => x.id === selected);
  if (it.bin === bin) {
    placed.set(it.id, bin);
    selected = null;
    sounds.good();
    $('feedback').textContent = '';
    render();
    if (p.items.every((x) => placed.has(x.id))) finish();
  } else {
    misses++;
    sounds.gentle();
    b.classList.add('shake');
    setTimeout(() => b.classList.remove('shake'), 350);
    $('feedback').textContent = misses >= 2 ? `Not that bin. ${p.attrHint}` : 'Not that bin. Try another.';
    $('feedback').className = 'feedback hint';
  }
});

function finish() {
  save.done[level.id] = (save.done[level.id] || 0) + 1;
  persist();
  $('feedback').textContent = misses === 0 ? 'All sorted, first time every time.' : 'All sorted.';
  $('feedback').className = 'feedback ok pop';
  $('explain').textContent = `The rule: ${p.explain}`;
  show($('explain'), true);
  $('play-right').textContent = 'Done';
  sounds.done();
}
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
renderTitle();
window.sortAndStack = { get puzzle() { return p; }, get placed() { return placed; }, start, LEVELS, select: (id) => { selected = id; render(); } };
