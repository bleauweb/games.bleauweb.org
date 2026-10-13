import { LEVELS, newGame, flip, flipBack, done } from './pairs.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'pairs.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let g = null;
let auto = true;
let missPending = false;

function load() { try { return { best: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { best: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function symbolSvg(symbol, color) {
  const c = color;
  const shapes = {
    circle: `<circle cx="50" cy="50" r="30" fill="${c}"/>`,
    square: `<rect x="22" y="22" width="56" height="56" rx="8" fill="${c}"/>`,
    triangle: `<polygon points="50,18 84,80 16,80" fill="${c}"/>`,
    star: `<polygon points="50,14 61,38 88,40 67,58 73,85 50,71 27,85 33,58 12,40 39,38" fill="${c}"/>`,
    hexagon: `<polygon points="50,16 80,33 80,67 50,84 20,67 20,33" fill="${c}"/>`,
    diamond: `<polygon points="50,14 84,50 50,86 16,50" fill="${c}"/>`,
    heart: `<path d="M50 84 C 20 60 16 40 30 30 C 40 24 48 30 50 38 C 52 30 60 24 70 30 C 84 40 80 60 50 84 Z" fill="${c}"/>`,
    moon: `<path d="M60 16 A 34 34 0 1 0 60 84 A 26 26 0 1 1 60 16 Z" fill="${c}"/>`,
    cross: `<path d="M38 16 H62 V38 H84 V62 H62 V84 H38 V62 H16 V38 H38 Z" fill="${c}"/>`,
    ring: `<circle cx="50" cy="50" r="28" fill="none" stroke="${c}" stroke-width="14"/>`,
    drop: `<path d="M50 14 C 50 14 22 48 22 62 A 28 28 0 0 0 78 62 C 78 48 50 14 50 14 Z" fill="${c}"/>`,
    leaf: `<path d="M20 80 C 20 40 50 16 84 18 C 84 54 56 82 20 80 Z M 20 80 L 70 30" fill="${c}" stroke="${c}" stroke-width="3"/>`,
  };
  return `<svg viewBox="0 0 100 100">${shapes[symbol]}</svg>`;
}

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const best = save.best[lv.id];
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${lv.tip}</div></div>${best ? `<span class="done">✓ best ${best} turns</span>` : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv) {
  level = lv;
  g = newGame(lv, Math.floor(Math.random() * 1e6));
  missPending = false;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = lv.by === 'shape' ? 'Match shapes; colours may differ.' : lv.by === 'color' ? 'Match colours; shapes may differ.' : 'Match shape and colour.';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}
function render() {
  const box = $('cards');
  box.style.setProperty('--cols', level.cols);
  box.innerHTML = g.cards.map((c) => `<button class="cardb ${g.matched.has(c.id) ? 'matched' : g.up.includes(c.id) ? 'up' : ''} ${missPending && g.up.includes(c.id) ? 'miss' : ''}" data-id="${c.id}" aria-label="card">${symbolSvg(c.symbol, c.color)}</button>`).join('');
  $('play-right').textContent = done(g) ? `Done in ${g.turns}` : `${g.pairsFound} / ${level.pairs} · ${g.turns} turns`;
}
$('cards').addEventListener('click', (e) => {
  const b = e.target.closest('.cardb');
  if (!b) return;
  if (missPending) { flipBack(g); missPending = false; render(); }
  const r = flip(g, Number(b.dataset.id));
  if (r === 'ignored') return;
  sounds.tap();
  if (r === 'match') {
    sounds.good();
    if (done(g)) {
      const best = save.best[level.id];
      save.best[level.id] = best ? Math.min(best, g.turns) : g.turns;
      persist();
      $('feedback').textContent = `All ${level.pairs} pairs in ${g.turns} turns.`;
      $('feedback').className = 'feedback ok pop';
      sounds.done();
    }
  } else if (r === 'miss') {
    missPending = true;
    sounds.gentle();
    if (auto) setTimeout(() => { if (missPending) { flipBack(g); missPending = false; render(); } }, 1100);
  }
  render();
});
$('btn-auto').addEventListener('click', () => { auto = !auto; $('btn-auto').textContent = auto ? 'Turn back: after a moment' : 'Turn back: when I tap next'; });
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
renderTitle();
window.pairs = { get game() { return g; }, start, LEVELS };
