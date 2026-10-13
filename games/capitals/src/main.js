import { LEVELS, countriesFor, flag } from './data.js';
import { MODES, makeQuestion, starsFor } from './quiz.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'capitals.save.v1';
const ROUNDS = 12;

function load() {
  const d = { stars: {}, stats: {} };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return d;
  }
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // ignore
  }
}
let save = load();
let level = LEVELS[0];
let modeId = 'capital';
let s = null;

function stars(n) {
  let out = '';
  for (let i = 1; i <= 3; i++) out += `<span class="${i <= n ? '' : 'dim'}">★</span>`;
  return out;
}
function levelStars(id) {
  return Math.max(0, ...Object.values(save.stars[id] || {}));
}
function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  for (const lv of LEVELS) {
    const pool = countriesFor(lv);
    const known = pool.filter((c) => { const st = save.stats[c.code]; return st && st.seen >= 2 && st.wrong / st.seen < 0.25; }).length;
    const row = document.createElement('div');
    row.className = 'level';
    row.innerHTML = `<div class="name"><span>${lv.name}</span><span class="stars">${stars(levelStars(lv.id))}</span></div>
      <div class="meta">${pool.length} countries · ${known} known well</div>
      <div class="modes">${Object.entries(MODES).map(([id, m]) => `<button class="mode-btn ${id}" data-mode="${id}">${m.name}</button>`).join('')}</div>`;
    row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => start(lv, b.dataset.mode)));
    list.append(row);
  }
}
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress?')) return;
  localStorage.removeItem(KEY);
  save = load();
  renderTitle();
});

function start(lv, m) {
  level = lv;
  modeId = m;
  s = { i: 0, correct: 0, misses: [], last: null, busy: false, q: null };
  show($('screen-title'), false);
  show($('screen-results'), false);
  show($('screen-play'), true);
  $('play-title').textContent = `${lv.name} · ${MODES[m].name}`;
  $('play-sub').textContent = 'Pick one of four. Wrong answers come back.';
  next();
}
function toTitle() {
  s = null;
  show($('screen-play'), false);
  show($('screen-results'), false);
  renderTitle();
  show($('screen-title'), true);
}
$('btn-close').addEventListener('click', toTitle);

function next() {
  if (s.i >= ROUNDS) return finish();
  const q = makeQuestion(level, modeId, save.stats, Math.random, s.last);
  s.q = q;
  s.last = q.target.code;
  s.busy = false;
  const mode = MODES[modeId];
  $('prompt').textContent = q.prompt;
  $('prompt').className = `prompt ${mode.big ? 'flag' : ''}`;
  $('hint').textContent = mode.big ? 'Which country is this?' : modeId === 'pickflag' ? '' : `${flag(q.target.code)} ${q.target.region}`;
  if (modeId === 'country' || modeId === 'capital') $('hint').textContent = q.target.region;
  $('play-right').textContent = `${s.i + 1} / ${ROUNDS}`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  const box = $('options');
  box.className = `options ${mode.flags ? 'flags' : ''}`;
  box.innerHTML = '';
  for (const o of q.options) {
    const b = document.createElement('button');
    b.className = 'opt';
    b.textContent = o.label;
    b.addEventListener('click', () => answer(o, b));
    box.append(b);
  }
  return undefined;
}
function answer(o, btn) {
  if (s.busy) return;
  s.busy = true;
  const q = s.q;
  const ok = o.code === q.target.code;
  const st = save.stats[q.target.code] || { seen: 0, wrong: 0 };
  st.seen++;
  if (!ok) st.wrong++;
  save.stats[q.target.code] = st;
  for (const b of $('options').children) {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('ok');
  }
  if (ok) {
    s.correct++;
    $('feedback').textContent = modeId === 'pickflag' ? 'Yes!' : `Yes: ${q.target.name}, ${q.target.capital} ${flag(q.target.code)}`;
    $('feedback').className = 'feedback ok';
  } else {
    btn.classList.add('bad');
    s.misses.push(q.target);
    $('feedback').textContent = `No. ${q.target.name}: ${q.target.capital} ${flag(q.target.code)}`;
    $('feedback').className = 'feedback bad';
  }
  s.i++;
  persist();
  setTimeout(next, ok ? 900 : 1900);
}
function finish() {
  const st = starsFor(s.correct, ROUNDS);
  save.stars[level.id] = { ...(save.stars[level.id] || {}), [modeId]: Math.max((save.stars[level.id] || {})[modeId] || 0, st) };
  persist();
  $('res-title').textContent = st === 3 ? 'Globetrotter!' : st >= 1 ? 'Nice' : 'Keep exploring';
  $('res-stars').innerHTML = stars(st);
  $('res-text').textContent = `${s.correct} of ${ROUNDS} right.`;
  const box = $('res-misses');
  box.innerHTML = '';
  const seen = new Set();
  for (const c of s.misses) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    const el = document.createElement('span');
    el.className = 'miss';
    el.textContent = `${flag(c.code)} ${c.name} · ${c.capital}`;
    box.append(el);
  }
  $('btn-again').textContent = 'Again';
  show($('screen-play'), false);
  show($('screen-results'), true);
}
$('btn-again').addEventListener('click', () => start(level, modeId));
$('btn-res-menu').addEventListener('click', toTitle);
renderTitle();
window.capitals = { get session() { return s; }, start, LEVELS };
