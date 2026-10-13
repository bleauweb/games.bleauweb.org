// Flute Fingers: learn / finger it / name it / play it (microphone).
import { LEVELS, TIPS, primary, alternatives, matches, diff, displayName, parseKey, pitchClassOf, midiOf, starsFor, PASS_FRACTION, KEYS } from './fingerings.js';
import { FluteDiagram } from './flute.js';
import { Staff, NOTE_X } from '../../treble-maker/src/staff.js';
import { Piano } from '../../treble-maker/src/piano.js';
import { audio } from '../../treble-maker/src/audio.js';
import { PitchListener, midiName } from '/shared/pitch.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'flute-fingers.save.v1';
const ROUNDS = 10;
const MODE_NAMES = { learn: 'Learn', finger: 'Finger it', name: 'Name it', playit: 'Play it' };

function load() {
  const d = { unlocked: 1, stars: {}, muted: false };
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
let mode = 'learn';
let s = null;
let timer = 0;

const staff = new Staff($('staff'));
staff.setLabels(false);
const flute = new FluteDiagram($('flute'), { interactive: false, onChange: () => onFlute() });
const piano = new Piano($('piano'), { onKey: (pc) => onPiano(pc), labels: true });
audio.setMuted(save.muted);

const mic = new PitchListener({
  onNote: (m) => onMicNote(m),
  onPitch: (p) => {
    const dot = $('mic-dot');
    dot.classList.toggle('loud', p.rms > 0.02);
    if (p.nearest !== null) $('mic-status').textContent = `Hearing ${midiName(p.nearest)} (${p.cents > 0 ? '+' : ''}${Math.round(p.cents)}¢)`;
    else if (mic.running) $('mic-status').textContent = 'Listening… play the note';
  },
  onState: (st) => {
    $('mic-dot').classList.toggle('on', st === 'on');
    if (st === 'off') $('mic-status').textContent = 'Microphone off';
  },
});

// ---------- title ----------

function stars(n) {
  let out = '';
  for (let i = 1; i <= 3; i++) out += `<span class="${i <= n ? '' : 'dim'}">★</span>`;
  return out;
}

function levelStars(id) {
  const st = save.stars[id] || {};
  return Math.max(st.finger || 0, st.name || 0, st.playit || 0);
}

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const open = i < save.unlocked;
    const row = document.createElement('div');
    row.className = 'level' + (open ? '' : ' locked');
    row.innerHTML = `
      <div class="name">${i + 1}. ${lv.name}</div>
      <div class="meta"><span class="stars">${stars(levelStars(lv.id))}</span> · ${lv.notes.length} notes${open ? '' : ' · pass the level before'}</div>
      <div class="modes">
        <button class="mode-btn learn" ${open ? '' : 'disabled'}>Learn</button>
        <button class="mode-btn finger" ${open ? '' : 'disabled'}>Finger it</button>
        <button class="mode-btn name" ${open ? '' : 'disabled'}>Name it</button>
        <button class="mode-btn playit" ${open ? '' : 'disabled'}>🎤 Play it</button>
      </div>`;
    const [a, b, c, d] = row.querySelectorAll('button');
    a.addEventListener('click', () => start(lv, 'learn'));
    b.addEventListener('click', () => start(lv, 'finger'));
    c.addEventListener('click', () => start(lv, 'name'));
    d.addEventListener('click', () => start(lv, 'playit'));
    list.append(row);
  });
  $('btn-mute').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
}

$('btn-mute').addEventListener('click', () => {
  save.muted = !save.muted;
  audio.unlock();
  audio.setMuted(save.muted);
  persist();
  renderTitle();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress?')) return;
  localStorage.removeItem(KEY);
  save = load();
  renderTitle();
});

// ---------- common ----------

function start(lv, m) {
  audio.unlock();
  clearTimeout(timer);
  level = lv;
  mode = m;
  show($('screen-title'), false);
  show($('screen-results'), false);
  show($('screen-play'), true);
  $('play-title').textContent = `${lv.name} · ${MODE_NAMES[m]}`;
  $('play-right').textContent = '';
  feedback('');
  staff.clear();
  staff.caption('');
  flute.clear();
  flute.setInteractive(m === 'finger');
  show($('piano'), m === 'name');
  show($('micbar'), m === 'playit');
  show($('flute').parentElement, m !== 'name' || true);
  if (m === 'learn') setupLearn();
  else setupQuiz();
}

function toTitle() {
  clearTimeout(timer);
  if (mic.running) mic.stop();
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

function showNote(key, { label = false } = {}) {
  staff.clear();
  const item = { clef: 'treble', note: parseKey(key) };
  return staff.addNote(item, NOTE_X, { label: label ? displayName(key) : null });
}

function keyNames(ids) {
  return ids.map((id) => KEYS.find((k) => k.id === id)).map((k) => (k.id.startsWith('L') || k.id.startsWith('R') ? `${k.id[0] === 'L' ? 'left' : 'right'} ${k.label}` : k.name.toLowerCase())).join(', ');
}

// ---------- learn ----------

function setupLearn() {
  $('play-sub').textContent = level.tip;
  s = { kind: 'learn', key: level.notes[0], alt: 0 };
  renderLearn();
}

function renderLearn() {
  const key = s.key;
  const alts = alternatives(key);
  showNote(key, { label: true });
  flute.setPressed(alts[s.alt % alts.length]);
  feedback(TIPS[key] || '', 'hint');
  setControls([
    ...level.notes.map((k) => chip(displayName(k), k === key, () => { s.key = k; s.alt = 0; renderLearn(); })),
    chip('🔊 Hear it', false, () => audio.note(midiOf(key), { dur: 1.6, vol: 0.35 })),
    ...(alts.length > 1 ? [chip(`Other fingering (${(s.alt % alts.length) + 1}/${alts.length})`, false, () => { s.alt++; renderLearn(); })] : []),
  ]);
}

// ---------- quizzes (finger it / name it / play it) ----------

function setupQuiz() {
  s = { kind: mode, i: 0, correct: 0, misses: [], key: null, last: null, busy: false, wrongHere: 0 };
  $('play-sub').textContent = {
    finger: 'Tap the keys this note needs, then Check.',
    name: 'Which note is this fingering? Press it on the piano.',
    playit: 'Play the note on your flute. The microphone checks pitch and octave.',
  }[mode];
  if (mode === 'playit') {
    setControls([chip(mic.running ? '🎤 Microphone on' : '🎤 Turn on microphone', mic.running, toggleMic, 'big-chip')]);
    if (!mic.running) feedback('Turn on the microphone to start.', 'hint');
  } else if (mode === 'finger') {
    setControls([chip('Clear', false, () => flute.clear()), chip('Check', false, checkFingering, 'go big-chip')]);
  } else setControls([]);
  if (mode !== 'playit' || mic.running) nextQuestion();
}

async function toggleMic() {
  try {
    if (mic.running) {
      mic.stop();
      setupQuiz();
      return;
    }
    await mic.start();
    setupQuiz();
  } catch (e) {
    feedback(e.message || 'Could not start the microphone.', 'bad');
  }
}

function nextQuestion() {
  if (s.i >= ROUNDS) return finishQuiz();
  const pool = level.notes.filter((k) => k !== s.last);
  const key = pool[Math.floor(Math.random() * pool.length)];
  s.key = key;
  s.last = key;
  s.busy = false;
  s.wrongHere = 0;
  $('play-right').textContent = `${s.i + 1} / ${ROUNDS}`;
  flute.clear();
  staff.caption('');
  if (mode === 'name') {
    staff.clear();
    flute.setPressed(primary(key));
    staff.caption('Which note?');
  } else {
    showNote(key);
    if (mode === 'playit') feedback('', '');
    else feedback('', '');
  }
}

function settle(ok, extraDelay = 0) {
  if (ok) s.correct++;
  else s.misses.push(s.key);
  s.i++;
  s.busy = true;
  timer = setTimeout(nextQuestion, (ok ? 900 : 1900) + extraDelay);
}

function checkFingering() {
  if (s.busy || !s.key) return;
  const pressed = flute.pressed;
  if (matches(s.key, pressed)) {
    flute.showResult({});
    audio.note(midiOf(s.key), { dur: 1.2, vol: 0.3 });
    staff.caption(`${displayName(s.key)} ✓`, 'ok');
    feedback('Yes!', 'ok');
    settle(s.wrongHere === 0);
  } else {
    const d = diff(s.key, pressed);
    flute.showResult(d);
    audio.bad();
    s.wrongHere++;
    const parts = [];
    if (d.missing.length) parts.push(`add ${keyNames(d.missing)}`);
    if (d.extra.length) parts.push(`lift ${keyNames(d.extra)}`);
    feedback(`Not yet: ${parts.join('; ')}.`, 'bad');
    if (s.wrongHere >= 2) {
      flute.setPressed(d.target);
      flute.showResult({});
      staff.caption(`${displayName(s.key)}`, 'bad');
      settle(false);
    }
  }
}

function onFlute() {
  if (mode !== 'finger' || !s || s.busy) return;
  feedback('');
}

function onPiano(pc) {
  if (mode !== 'name' || !s || s.busy || !s.key) return;
  audio.unlock();
  const ok = pc === pitchClassOf(s.key);
  piano.flash(pc, ok);
  if (ok) {
    audio.note(midiOf(s.key), { dur: 1.2, vol: 0.3 });
    staff.caption(`${displayName(s.key)} ✓`, 'ok');
    showNote(s.key, { label: true });
    feedback('Yes!', 'ok');
    settle(s.wrongHere === 0);
  } else {
    audio.bad();
    s.wrongHere++;
    feedback(s.wrongHere >= 2 ? `It is ${displayName(s.key)}.` : 'Not that one. Look at which fingers are down.', 'bad');
    if (s.wrongHere >= 2) {
      staff.caption(displayName(s.key), 'bad');
      showNote(s.key, { label: true });
      settle(false);
    }
  }
}

function onMicNote(m) {
  if (mode !== 'playit' || !s || s.busy || !s.key) return;
  const target = midiOf(s.key);
  if (m === target) {
    staff.caption(`${displayName(s.key)} ✓`, 'ok');
    flute.setPressed(primary(s.key));
    flute.showResult({});
    feedback(s.wrongHere ? 'There it is.' : 'Lovely!', 'ok');
    audio.good();
    settle(s.wrongHere === 0);
  } else if (((m - target) % 12 + 12) % 12 === 0) {
    s.wrongHere++;
    feedback(m < target ? 'Right fingering, an octave low: faster air, aim a little higher.' : 'Right fingering, an octave high: slower, warmer air.', 'hint');
  } else {
    s.wrongHere++;
    feedback(`That was ${midiName(m)}. ${s.wrongHere >= 2 ? `We want ${displayName(s.key)}: ${TIPS[s.key] || ''}` : 'Try again.'}`, 'bad');
    if (s.wrongHere >= 3) {
      flute.setPressed(primary(s.key));
      staff.caption(displayName(s.key), 'bad');
      settle(false);
    }
  }
}

function finishQuiz() {
  const st = starsFor(s.correct, ROUNDS);
  const rec = save.stars[level.id] || {};
  rec[mode] = Math.max(rec[mode] || 0, st);
  save.stars[level.id] = rec;
  const idx = LEVELS.indexOf(level);
  const passed = s.correct / ROUNDS >= PASS_FRACTION;
  let unlocked = false;
  if (passed && idx + 1 < LEVELS.length && save.unlocked <= idx + 1) {
    save.unlocked = idx + 2;
    unlocked = true;
  }
  persist();
  if (st === 3) audio.fanfare();
  $('res-title').textContent = st === 3 ? 'Flawless fingers!' : passed ? 'Passed' : 'Keep at it';
  $('res-stars').innerHTML = stars(st);
  $('res-text').textContent = `${s.correct} of ${ROUNDS} first time.${passed ? '' : ` You need ${Math.ceil(PASS_FRACTION * ROUNDS)} to pass.`}${unlocked ? ' Next level unlocked!' : ''}`;
  const box = $('res-misses');
  box.innerHTML = '';
  for (const k of new Set(s.misses)) {
    const c = document.createElement('span');
    c.className = 'miss';
    c.textContent = displayName(k);
    box.append(c);
  }
  $('btn-again').textContent = `${MODE_NAMES[mode]} again`;
  show($('screen-play'), false);
  show($('screen-results'), true);
}

$('btn-again').addEventListener('click', () => start(level, mode));
$('btn-res-menu').addEventListener('click', toTitle);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mic.running) mic.stop();
});

renderTitle();
window.fluteFingers = { staff, flute, piano, mic, get session() { return s; }, start, LEVELS };
