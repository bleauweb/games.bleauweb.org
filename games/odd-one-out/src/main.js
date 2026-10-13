import { LEVELS, makePuzzle, COLORS, ROUNDS, PASS } from './odd.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'odd-one-out.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let s = null;

function load() { try { return { best: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { best: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function shapePath(shape, cx, cy, r) {
  if (shape === 'circle') return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  if (shape === 'square') return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.15}"/>`;
  if (shape === 'triangle') return `<polygon points="${cx},${cy - r * 1.1} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}"/>`;
  if (shape === 'star') {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.5 : r * 1.05; pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`); }
    return `<polygon points="${pts.join(' ')}"/>`;
  }
  const pts = [];
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`); }
  return `<polygon points="${pts.join(' ')}"/>`;
}
export function itemSvg(it) {
  const c = COLORS[it.color];
  const r = it.size === 'small' ? 9 : 14;
  const centers = it.count === 1 ? [[50, 50]] : it.count === 2 ? [[32, 50], [68, 50]] : [[50, 30], [30, 66], [70, 66]];
  const style = it.fill === 'solid' ? `fill="${c}"` : `fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"`;
  return `<svg viewBox="0 0 100 100"><g ${style}>${centers.map(([x, y]) => shapePath(it.shape, x, y, r)).join('')}</g></svg>`;
}

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const best = save.best[lv.id];
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${lv.tip}</div></div>${best !== undefined ? (best >= PASS ? `<span class="done">✓ ${best}/${ROUNDS}</span>` : `<span class="prog">${best}/${ROUNDS}</span>`) : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv) {
  level = lv;
  s = { i: 0, correct: 0, p: null, busy: false };
  show($('screen-title'), false);
  show($('screen-done'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = lv.tip;
  next();
}
function next() {
  if (s.i >= ROUNDS) return finish();
  s.p = makePuzzle(level, Math.floor(Math.random() * 1e6));
  s.busy = false;
  $('play-right').textContent = `${s.i + 1} / ${ROUNDS}`;
  const box = $('items');
  box.className = `items ${s.p.items.length >= 5 ? 'three' : ''}`;
  box.innerHTML = '';
  s.p.items.forEach((it, idx) => {
    const b = document.createElement('button');
    b.className = 'item';
    b.innerHTML = itemSvg(it);
    b.addEventListener('click', () => answer(idx, b));
    box.append(b);
  });
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  show($('explain'), false);
  show($('btn-next'), false);
  show($('btn-hint'), true);
  return undefined;
}
function answer(idx, btn) {
  if (s.busy) return;
  s.busy = true;
  const ok = idx === s.p.odd;
  for (const b of $('items').children) b.disabled = true;
  $('items').children[s.p.odd].classList.add('ok');
  if (!ok) btn.classList.add('bad');
  if (ok) { s.correct++; sounds.good(); } else sounds.gentle();
  $('feedback').textContent = ok ? 'That is the one.' : 'Not that one.';
  $('feedback').className = `feedback ${ok ? 'ok' : 'hint'}`;
  $('explain').textContent = s.p.explain;
  show($('explain'), true);
  show($('btn-hint'), false);
  show($('btn-next'), true);
  $('btn-next').textContent = s.i + 1 >= ROUNDS ? 'Finish' : 'Next';
  s.i++;
}
$('btn-hint').addEventListener('click', () => { $('feedback').textContent = s.p.hint; $('feedback').className = 'feedback hint'; });
$('btn-next').addEventListener('click', next);
function finish() {
  save.best[level.id] = Math.max(save.best[level.id] || 0, s.correct);
  persist();
  if (s.correct >= PASS) sounds.done();
  $('done-title').textContent = s.correct === ROUNDS ? 'Every one!' : s.correct >= PASS ? 'Level done' : 'A good try';
  $('done-text').textContent = `${s.correct} of ${ROUNDS} right.${s.correct >= PASS ? '' : ` ${PASS} marks the level as done.`}`;
  show($('screen-play'), false);
  show($('screen-done'), true);
}
$('btn-again').addEventListener('click', () => start(level));
$('btn-levels').addEventListener('click', toTitle);
$('btn-close').addEventListener('click', toTitle);
function toTitle() { show($('screen-play'), false); show($('screen-done'), false); renderTitle(); show($('screen-title'), true); }
renderTitle();
window.oddOneOut = { get session() { return s; }, start, LEVELS };
