import { LEVELS, makePattern, compare, scoreTaps, ROW_NAMES, ROW_COLORS } from './rhythm.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'rhythm-patterns.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let pattern = null;
let marked = null;
let mode = 'mark';
let stepMs = 500;
let playing = false;
let revealed = true; // pattern shown while playing; hidden while marking
let taps = [];
let tapStart = 0;
let timers = [];

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
  pattern = makePattern(lv, Math.floor(Math.random() * 1e6));
  marked = pattern.rows.map((r) => r.map(() => 0));
  revealed = false;
  taps = [];
  stopPlayback();
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = mode === 'mark' ? 'Play it, watch, then mark. Play again any time.' : 'Play it, then tap the pad on each drum step.';
  $('play-right').textContent = `${save.done[lv.id] || 0} done`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  show($('explain'), false);
  render();
}

function cellPx() {
  const avail = Math.min(window.innerWidth, 560) - 70;
  return Math.max(18, Math.min(40, Math.floor(avail / pattern.steps) - 4));
}

function render() {
  const g = $('grid');
  const px = cellPx();
  g.style.setProperty('--cell', `${px}px`);
  g.style.gridTemplateColumns = `auto repeat(${pattern.steps}, ${px}px)`;
  g.classList.toggle('locked', mode === 'tap');
  let html = '';
  pattern.rows.forEach((row, r) => {
    html += `<div class="rowlabel">${ROW_NAMES[r]}</div>`;
    row.forEach((v, i) => {
      const on = mode === 'tap' ? v : marked[r][i];
      html += `<div class="step ${on ? 'on' : ''} ${i % 4 === 0 ? 'beat' : ''}" data-r="${r}" data-i="${i}" style="--row:${ROW_COLORS[r]}"></div>`;
    });
  });
  g.innerHTML = html;
  show($('pad'), mode === 'tap');
  show($('btn-check'), mode === 'mark');
  $('mode-mark').classList.toggle('on', mode === 'mark');
  $('mode-tap').classList.toggle('on', mode === 'tap');
}

$('grid').addEventListener('click', (e) => {
  const s = e.target.closest('.step');
  if (!s || mode !== 'mark' || playing) return;
  const r = Number(s.dataset.r);
  const i = Number(s.dataset.i);
  marked[r][i] = marked[r][i] ? 0 : 1;
  s.classList.toggle('on', !!marked[r][i]);
  s.classList.remove('wrong');
  sounds.click(marked[r][i] ? 700 + r * 120 : 400);
});

function stopPlayback() {
  playing = false;
  for (const t of timers) clearTimeout(t);
  timers = [];
  document.querySelectorAll('.step.now').forEach((el) => el.classList.remove('now'));
}

/** Play the pattern: the current step is outlined, hits flash their colour and click. */
function play(onDone) {
  stopPlayback();
  playing = true;
  const cells = $('grid').querySelectorAll('.step');
  const at = (r, i) => cells[r * pattern.steps + i];
  for (let i = 0; i < pattern.steps; i++) {
    timers.push(setTimeout(() => {
      document.querySelectorAll('.step.now').forEach((el) => el.classList.remove('now'));
      pattern.rows.forEach((row, r) => {
        const el = at(r, i);
        el.classList.add('now');
        if (row[i]) {
          el.classList.add('on');
          sounds.click(r === 0 ? 220 : r === 1 ? 660 : 1200);
          if (mode === 'mark') timers.push(setTimeout(() => { if (!marked[r][i]) el.classList.remove('on'); }, stepMs * 0.8));
        }
      });
    }, i * stepMs));
  }
  timers.push(setTimeout(() => { stopPlayback(); onDone?.(); }, pattern.steps * stepMs + 50));
}

$('btn-play').addEventListener('click', () => {
  if (playing) return;
  if (mode === 'tap') {
    // Count-in, then the pattern plays while taps are recorded.
    $('feedback').textContent = 'Ready… the pattern starts after four clicks.';
    $('feedback').className = 'feedback hint';
    taps = [];
    for (let k = 0; k < 4; k++) timers.push(setTimeout(() => sounds.click(k === 0 ? 1000 : 800), k * stepMs * 2));
    timers.push(setTimeout(() => {
      tapStart = performance.now();
      play(() => scoreLive());
    }, 4 * stepMs * 2));
    playing = true;
  } else play();
});

$('btn-check').addEventListener('click', () => {
  if (playing) return;
  const r = compare(marked, pattern);
  for (const [row, i] of r.cells) $('grid').querySelectorAll('.step')[row * pattern.steps + i].classList.add('wrong');
  if (r.match) finish('Exactly right.');
  else {
    $('feedback').textContent = `${r.wrong} step${r.wrong === 1 ? '' : 's'} outlined in red differ. Play it again and fix them.`;
    $('feedback').className = 'feedback hint';
    sounds.gentle();
  }
});

function scoreLive() {
  const s = scoreTaps(taps.map((t) => t - tapStart), pattern.rows[0], stepMs, Math.max(140, stepMs * 0.35));
  const good = s.misses === 0 && s.extra === 0;
  if (good) finish(`Every drum step hit in time (${s.hits} of ${s.total}).`);
  else {
    $('feedback').textContent = `${s.hits} of ${s.total} drum steps in time${s.extra ? `, ${s.extra} extra tap${s.extra === 1 ? '' : 's'}` : ''}. Play it again whenever you like.`;
    $('feedback').className = 'feedback hint';
  }
}

function finish(text) {
  save.done[level.id] = (save.done[level.id] || 0) + 1;
  persist();
  $('feedback').textContent = text;
  $('feedback').className = 'feedback ok pop';
  $('play-right').textContent = `${save.done[level.id]} done`;
  sounds.done();
}

const pad = $('pad');
const padDown = (e) => { e.preventDefault(); pad.classList.add('down'); if (playing && tapStart) taps.push(performance.now()); sounds.click(220); };
const padUp = () => pad.classList.remove('down');
pad.addEventListener('pointerdown', padDown);
pad.addEventListener('pointerup', padUp);
pad.addEventListener('pointercancel', padUp);
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && mode === 'tap' && !e.repeat) padDown(e); });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') padUp(); });

$('mode-mark').addEventListener('click', () => { mode = 'mark'; stopPlayback(); start(level); });
$('mode-tap').addEventListener('click', () => { mode = 'tap'; stopPlayback(); start(level); });
$('speed').addEventListener('click', () => { stepMs = stepMs === 500 ? 350 : stepMs === 350 ? 700 : 500; $('speed').textContent = stepMs === 500 ? 'Slow' : stepMs === 350 ? 'Medium' : 'Very slow'; });
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { stopPlayback(); show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
renderTitle();
window.rhythmPatterns = { get pattern() { return pattern; }, get marked() { return marked; }, start, LEVELS, play };
