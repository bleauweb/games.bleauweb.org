import { LEVELS, makePuzzle, ROUNDS, PASS, SHAPES } from './sequences.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'sequence-lab.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let s = null;

function load() {
  try { return { best: {}, seedBase: Date.now() % 100000, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { best: {}, seedBase: 1 }; }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

// ---------- shapes as SVG ----------
const SIZE_R = { small: 11, medium: 17, large: 23 };
export function shapeSvg(it) {
  const r = SIZE_R[it.size];
  const c = it.color;
  let body = '';
  switch (it.shape) {
    case 'circle': body = `<circle cx="30" cy="30" r="${r}" fill="${c}"/>`; break;
    case 'square': body = `<rect x="${30 - r}" y="${30 - r}" width="${2 * r}" height="${2 * r}" rx="3" fill="${c}"/>`; break;
    case 'triangle': body = `<polygon points="30,${30 - r * 1.1} ${30 + r},${30 + r * 0.8} ${30 - r},${30 + r * 0.8}" fill="${c}"/>`; break;
    case 'diamond': body = `<polygon points="30,${30 - r * 1.15} ${30 + r * 0.85},30 30,${30 + r * 1.15} ${30 - r * 0.85},30" fill="${c}"/>`; break;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.5 : r * 1.1; pts.push(`${30 + rr * Math.cos(a)},${30 + rr * Math.sin(a)}`); }
      body = `<polygon points="${pts.join(' ')}" fill="${c}"/>`; break;
    }
    default: {
      const pts = [];
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; pts.push(`${30 + r * Math.cos(a)},${30 + r * Math.sin(a)}`); }
      body = `<polygon points="${pts.join(' ')}" fill="${c}"/>`;
    }
  }
  // A small notch marks orientation so rotation is visible on symmetric shapes.
  const notch = `<circle cx="30" cy="${30 - r * 0.6}" r="2.6" fill="rgba(0,0,0,0.35)"/>`;
  return `<svg viewBox="0 0 60 60"><g transform="rotate(${it.rotation} 30 30)">${body}${notch}</g></svg>`;
}

// ---------- title ----------
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

// ---------- play ----------
function start(lv) {
  level = lv;
  s = { i: 0, correct: 0, puzzle: null, busy: false };
  show($('screen-title'), false);
  show($('screen-done'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = lv.tip;
  next();
}
function next() {
  if (s.i >= ROUNDS) return finish();
  const seed = save.seedBase + s.i * 131 + LEVELS.indexOf(level) * 977 + (save.best[level.id] || 0) * 17;
  save.seedBase += 1;
  const p = makePuzzle(level, seed);
  s.puzzle = p;
  s.busy = false;
  $('play-right').textContent = `${s.i + 1} / ${ROUNDS}`;
  $('seq').innerHTML = p.shown.map((t) => `<div class="term">${p.kind === 'number' ? t : shapeSvg(t)}</div>`).join('') + `<div class="term q">?</div>`;
  const box = $('options');
  box.innerHTML = '';
  for (const o of p.options) {
    const b = document.createElement('button');
    b.className = 'opt';
    b.innerHTML = p.kind === 'number' ? o.label : shapeSvg(o.item);
    b.addEventListener('click', () => answer(o, b));
    box.append(b);
  }
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  show($('explain'), false);
  show($('btn-next'), false);
  return undefined;
}
function answer(o, btn) {
  if (s.busy) return;
  s.busy = true;
  const p = s.puzzle;
  const ok = o.value === p.answer;
  for (const b of $('options').children) b.disabled = true;
  const idx = p.options.indexOf(o);
  const right = p.options.findIndex((x) => x.value === p.answer);
  $('options').children[right].classList.add('ok');
  if (!ok) $('options').children[idx].classList.add('bad');
  if (ok) { s.correct++; sounds.good(); } else sounds.gentle();
  $('feedback').textContent = ok ? 'Yes.' : 'Not that one. Here is the rule:';
  $('feedback').className = `feedback ${ok ? 'ok' : 'hint'}`;
  $('explain').textContent = p.explain;
  show($('explain'), true);
  show($('btn-next'), true);
  $('btn-next').textContent = s.i + 1 >= ROUNDS ? 'Finish' : 'Next';
  s.i++;
}
$('btn-next').addEventListener('click', next);
function finish() {
  save.best[level.id] = Math.max(save.best[level.id] || 0, s.correct);
  persist();
  if (s.correct >= PASS) sounds.done();
  $('done-title').textContent = s.correct === ROUNDS ? 'All of them!' : s.correct >= PASS ? 'Level done' : 'A good try';
  $('done-text').textContent = `${s.correct} of ${ROUNDS} right.${s.correct >= PASS ? '' : ` ${PASS} marks the level as done. Every rule is shown after the answer, so each try teaches the next.`}`;
  show($('screen-play'), false);
  show($('screen-done'), true);
}
$('btn-again').addEventListener('click', () => start(level));
$('btn-levels').addEventListener('click', toTitle);
$('btn-close').addEventListener('click', toTitle);
function toTitle() {
  show($('screen-play'), false);
  show($('screen-done'), false);
  renderTitle();
  show($('screen-title'), true);
}
renderTitle();
window.sequenceLab = { get session() { return s; }, start, LEVELS, SHAPES };
