// Morse Ear: Koch-method lessons. Learn, Copy (random groups), Words, Send (key it yourself).
import { MORSE, KOCH, LESSON_COUNT, lessonChars, schedule, timing, randomGroup, wordsFrom, keyedToCode, decode } from './morse.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'morse-ear.save.v1';
const ROUNDS = 10;
const MODE_NAMES = { learn: 'Learn', copy: 'Copy', words: 'Words', send: 'Send' };

function load() {
  const d = { unlocked: 1, stars: {}, wpm: 20, eff: 10 };
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
let lesson = 1;
let mode = 'learn';
let s = null;

// ---------- audio ----------
let ctx = null;
let playingUntil = 0;
function unlock() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}
/** Play text; resolves when it is over. Also drives the lamp. */
function play(text) {
  unlock();
  const sch = schedule(text, save.wpm, save.eff);
  const t0 = ctx.currentTime + 0.08;
  for (const tone of sch.tones) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 600;
    const a = t0 + tone.at / 1000;
    const b = a + tone.dur / 1000;
    g.gain.setValueAtTime(0.0001, a);
    g.gain.exponentialRampToValueAtTime(0.4, a + 0.005);
    g.gain.setValueAtTime(0.4, b - 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, b);
    o.connect(g).connect(ctx.destination);
    o.start(a);
    o.stop(b + 0.01);
    setTimeout(() => $('pulse').classList.add('on'), 80 + tone.at);
    setTimeout(() => $('pulse').classList.remove('on'), 80 + tone.at + tone.dur);
  }
  playingUntil = performance.now() + 80 + sch.total;
  return new Promise((r) => setTimeout(r, 80 + sch.total + 150));
}
function beep(f, dur = 0.08, vol = 0.15) {
  unlock();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = f;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

// ---------- title ----------
function stars(n) {
  let out = '';
  for (let i = 1; i <= 3; i++) out += `<span class="${i <= n ? '' : 'dim'}">★</span>`;
  return out;
}
function renderTitle() {
  $('wpm').value = save.wpm;
  $('eff').value = save.eff;
  const list = $('lessons');
  list.innerHTML = '';
  for (let n = 1; n <= LESSON_COUNT; n++) {
    const open = n <= save.unlocked;
    const chars = lessonChars(n);
    const row = document.createElement('div');
    row.className = 'lesson' + (open ? '' : ' locked');
    row.innerHTML = `<div class="name"><span>Lesson ${n} · ${n === 1 ? 'K and M' : `adds ${chars[chars.length - 1]}`}</span><span class="stars">${stars(save.stars[n] || 0)}</span></div>
      <div class="chars">${chars.join(' ')}</div>
      <div class="modes"><button class="mode-btn learn" ${open ? '' : 'disabled'}>Learn</button><button class="mode-btn copy" ${open ? '' : 'disabled'}>Copy</button><button class="mode-btn words" ${open ? '' : 'disabled'}>Words</button><button class="mode-btn send" ${open ? '' : 'disabled'}>Send</button></div>`;
    const [a, b, c, d] = row.querySelectorAll('button');
    a.addEventListener('click', () => start(n, 'learn'));
    b.addEventListener('click', () => start(n, 'copy'));
    c.addEventListener('click', () => start(n, 'words'));
    d.addEventListener('click', () => start(n, 'send'));
    list.append(row);
  }
}
$('wpm').addEventListener('change', () => { save.wpm = Number($('wpm').value); persist(); });
$('eff').addEventListener('change', () => { save.eff = Number($('eff').value); persist(); });
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress?')) return;
  localStorage.removeItem(KEY);
  save = load();
  renderTitle();
});

// ---------- common ----------
function start(n, m) {
  unlock();
  lesson = n;
  mode = m;
  show($('screen-title'), false);
  show($('screen-results'), false);
  show($('screen-play'), true);
  $('play-title').textContent = `Lesson ${n} · ${MODE_NAMES[m]}`;
  $('play-right').textContent = '';
  $('big').textContent = '';
  $('code').textContent = '';
  feedback('');
  show($('answer'), false);
  show($('keys'), false);
  show($('keyer'), false);
  if (m === 'learn') setupLearn();
  else if (m === 'send') setupSend();
  else setupCopy();
}
function toTitle() {
  s = null;
  show($('screen-play'), false);
  show($('screen-results'), false);
  renderTitle();
  show($('screen-title'), true);
}
$('btn-close').addEventListener('click', toTitle);
function feedback(text, cls = '') {
  const f = $('feedback');
  f.textContent = text;
  f.className = `feedback ${cls}`;
}
function chip(label, on, onClick, extra = '') {
  const b = document.createElement('button');
  b.className = `chip ${on ? 'on' : ''} ${extra}`;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
function setControls(buttons) {
  const c = $('controls');
  c.innerHTML = '';
  for (const b of buttons) c.append(b);
}

// ---------- learn ----------
function setupLearn() {
  const chars = lessonChars(lesson);
  $('play-sub').textContent = 'Tap a character to hear it. Listen for the rhythm, not the dots and dashes.';
  s = { kind: 'learn' };
  setControls([
    ...chars.map((c) => chip(c, false, async () => {
      $('big').textContent = c;
      $('code').textContent = MORSE[c];
      await play(c);
    })),
    chip('▶ All', false, async () => {
      for (const c of chars) {
        $('big').textContent = c;
        $('code').textContent = MORSE[c];
        await play(c);
      }
    }, 'go'),
  ]);
}

// ---------- copy / words ----------
function setupCopy() {
  const chars = lessonChars(lesson);
  const pool = mode === 'words' ? wordsFrom(chars) : null;
  if (mode === 'words' && pool.length < 3) {
    feedback('Not enough words yet from these characters. Try Copy, or a later lesson.', 'hint');
    setControls([]);
    s = { kind: 'idle' };
    return;
  }
  $('play-sub').textContent = mode === 'words' ? 'A word is sent. Type it, then Enter.' : 'A group of five is sent. Type what you heard, then Enter. Tap “Again” to repeat it.';
  s = { kind: 'copy', i: 0, correct: 0, misses: [], target: '', busy: false, pool };
  show($('answer'), true);
  $('answer').value = '';
  setControls([chip('🔊 Again', false, () => { if (s.target && !s.busy) play(s.target); }), chip('Check', false, submitCopy, 'go')]);
  next();
}
async function next() {
  if (s.i >= ROUNDS) return finish();
  const chars = lessonChars(lesson);
  s.target = mode === 'words' ? s.pool[Math.floor(Math.random() * s.pool.length)] : randomGroup(chars, 5);
  s.busy = false;
  $('big').textContent = '';
  $('code').textContent = '';
  $('answer').value = '';
  $('play-right').textContent = `${s.i + 1} / ${ROUNDS}`;
  $('answer').focus();
  await play(s.target);
  return undefined;
}
function submitCopy() {
  if (!s || s.kind !== 'copy' || s.busy) return;
  const got = $('answer').value.toUpperCase().replace(/\s+/g, '');
  if (!got) return;
  s.busy = true;
  const ok = got === s.target;
  $('big').textContent = s.target;
  $('code').textContent = s.target.split('').map((c) => MORSE[c]).join('  ');
  if (ok) {
    s.correct++;
    feedback('Correct!', 'ok');
    beep(1320);
  } else {
    s.misses.push(`${s.target} → ${got}`);
    feedback(`It was ${s.target}.`, 'bad');
    beep(200, 0.25);
  }
  s.i++;
  setTimeout(() => { feedback(''); next(); }, ok ? 900 : 2200);
}
$('answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitCopy();
});

// ---------- send ----------
function setupSend() {
  const chars = lessonChars(lesson);
  $('play-sub').textContent = 'Key the character shown: hold for a dah, tap for a dit. Pause to end the character.';
  s = { kind: 'send', i: 0, correct: 0, misses: [], target: chars[Math.floor(Math.random() * chars.length)], events: [], timer: 0, busy: false, down: 0 };
  show($('keyer'), true);
  setControls([chip('🔊 Hear it', false, () => play(s.target))]);
  showSendTarget();
}
function showSendTarget() {
  $('big').textContent = s.target;
  $('code').textContent = '';
  $('play-right').textContent = `${s.i + 1} / ${ROUNDS}`;
}
const unit = () => timing(Math.min(save.wpm, 15)).dit; // keying is judged at a gentle speed
function keyDown(e) {
  if (!s || s.kind !== 'send' || s.busy) return;
  e.preventDefault();
  if (s.down) return;
  s.down = performance.now();
  $('keyer').classList.add('down');
  $('pulse').classList.add('on');
  clearTimeout(s.timer);
  if (!s.osc) {
    unlock();
    s.osc = ctx.createOscillator();
    s.gain = ctx.createGain();
    s.osc.frequency.value = 600;
    s.gain.gain.value = 0.35;
    s.osc.connect(s.gain).connect(ctx.destination);
    s.osc.start();
  }
}
function keyUp() {
  if (!s || s.kind !== 'send' || !s.down) return;
  const up = performance.now();
  s.events.push({ down: s.down, up });
  s.down = 0;
  $('keyer').classList.remove('down');
  $('pulse').classList.remove('on');
  if (s.osc) {
    s.osc.stop();
    s.osc = null;
  }
  $('code').textContent = keyedToCode(s.events, unit());
  clearTimeout(s.timer);
  s.timer = setTimeout(judgeSend, unit() * 3.5);
}
function judgeSend() {
  if (!s || s.kind !== 'send') return;
  const code = keyedToCode(s.events, unit());
  const got = decode(code);
  const ok = got === s.target;
  s.busy = true;
  if (ok) {
    s.correct++;
    feedback(`${s.target} — clean!`, 'ok');
    beep(1320);
  } else {
    s.misses.push(`${s.target} (${MORSE[s.target]}) sent as ${code}`);
    feedback(`That decoded as “${got}”. ${s.target} is ${MORSE[s.target]}.`, 'bad');
    beep(200, 0.25);
  }
  s.i++;
  setTimeout(() => {
    if (s.i >= ROUNDS) return finish();
    const chars = lessonChars(lesson);
    s.target = chars[Math.floor(Math.random() * chars.length)];
    s.events = [];
    s.busy = false;
    feedback('');
    showSendTarget();
    return undefined;
  }, ok ? 900 : 2400);
}
$('keyer').addEventListener('pointerdown', keyDown);
$('keyer').addEventListener('pointerup', keyUp);
$('keyer').addEventListener('pointercancel', keyUp);
$('keyer').addEventListener('pointerleave', keyUp);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && mode === 'send' && !$('screen-play').classList.contains('hidden')) keyDown(e);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && mode === 'send') keyUp();
});

// ---------- results ----------
function finish() {
  const acc = s.correct / ROUNDS;
  const st = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.5 ? 1 : 0;
  save.stars[lesson] = Math.max(save.stars[lesson] || 0, st);
  let unlocked = false;
  if (acc >= 0.9 && lesson + 1 <= LESSON_COUNT && save.unlocked <= lesson) {
    save.unlocked = lesson + 1;
    unlocked = true;
  }
  persist();
  $('res-title').textContent = st === 3 ? 'Solid copy!' : st >= 1 ? 'Getting there' : 'Keep listening';
  $('res-stars').innerHTML = stars(st);
  $('res-text').textContent = `${s.correct} of ${ROUNDS}.${acc >= 0.9 ? '' : ' Koch says: 90% before adding the next character.'}${unlocked ? ' Next lesson unlocked!' : ''}`;
  const box = $('res-misses');
  box.innerHTML = '';
  for (const m of s.misses) {
    const c = document.createElement('span');
    c.className = 'miss';
    c.textContent = m;
    box.append(c);
  }
  $('btn-again').textContent = `${MODE_NAMES[mode]} again`;
  show($('screen-play'), false);
  show($('screen-results'), true);
}
$('btn-again').addEventListener('click', () => start(lesson, mode));
$('btn-res-menu').addEventListener('click', toTitle);

renderTitle();
window.morseEar = { get session() { return s; }, start, play, submitCopy, judgeSend, KOCH };
