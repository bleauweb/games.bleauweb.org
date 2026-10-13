// Screens and the three ways to work on a song: Listen, Learn (step through), Play (in time).
import { SONGS, LEVEL_ORDER, parseSong, phrasesOf, eventsIn, starsFor } from './songs.js';
import { Score } from './score.js';
import { Piano } from '../../treble-maker/src/piano.js';
import { audio } from '../../treble-maker/src/audio.js';
import { noteName } from '../../treble-maker/src/music.js';
import { PitchListener, midiName } from '/shared/pitch.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'note-by-note.save.v1';
const HIT_WINDOW = 0.45; // beats either side of a note in Play mode
const PERFECT = 0.15;

function load() {
  const d = { learn: {}, play: {}, best: {}, hints: true, metronome: true, speed: 0.75, muted: false, labels: true };
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
let song = null;
let mode = 'learn';
let phrase = null; // null = whole song
let s = null; // session
let raf = 0;

const score = new Score($('score'));
const piano = new Piano($('piano'), { onKey: onKey, labels: save.labels });
audio.setMuted(save.muted);

// Play the song on a real instrument: a detected note counts like a key press.
const mic = new PitchListener({
  onNote: (m) => onKey(((m % 12) + 12) % 12),
  onPitch: (p) => {
    if (!mic.running) return;
    $('mic-status').textContent = p.nearest !== null ? `Hearing ${midiName(p.nearest)}` : 'Listening…';
  },
  onState: (st) => {
    $('btn-mic').textContent = st === 'on' ? '🎤 Microphone on' : '🎤 Use my instrument';
    $('btn-mic').classList.toggle('on', st === 'on');
    $('mic-status').textContent = st === 'on' ? 'Listening…' : '';
  },
});
$('btn-mic').addEventListener('click', async () => {
  try {
    if (mic.running) mic.stop();
    else await mic.start();
  } catch (e) {
    $('mic-status').textContent = e.message || 'Could not start the microphone.';
  }
});
const sound = (midiNumber, opts) => {
  if (!mic.running) audio.note(midiNumber, opts);
};

// ---------- song list ----------

function stars(n) {
  let out = '';
  for (let i = 1; i <= 3; i++) out += `<span class="${i <= n ? '' : 'dim'}">★</span>`;
  return out;
}

function renderTitle() {
  const box = $('songs');
  box.innerHTML = '';
  for (const level of LEVEL_ORDER) {
    const group = SONGS.filter((d) => d.level === level);
    if (!group.length) continue;
    const h = document.createElement('div');
    h.className = 'group-title';
    h.textContent = level;
    box.append(h);
    for (const def of group) {
      const card = document.createElement('div');
      card.className = 'song';
      const learn = save.learn[def.id] || 0;
      const best = save.best[def.id];
      card.innerHTML = `
        <div class="name">${def.title}</div>
        <div class="meta"><span>${def.origin}</span><span>${def.time}</span><span class="stars" title="Learn">${stars(learn)}</span>${best ? `<span>play best ${Math.round(best * 100)}%</span>` : ''}</div>
        <div class="modes">
          <button class="mode-btn listen">Listen</button>
          <button class="mode-btn learn">Learn</button>
          <button class="mode-btn playmode">Play</button>
        </div>`;
      const [l, le, p] = card.querySelectorAll('button');
      l.addEventListener('click', () => start(def, 'listen'));
      le.addEventListener('click', () => start(def, 'learn'));
      p.addEventListener('click', () => start(def, 'play'));
      box.append(card);
    }
  }
  $('btn-mute').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
  $('btn-key-labels').textContent = `Key names: ${save.labels ? 'on' : 'off'}`;
}

$('btn-mute').addEventListener('click', () => {
  save.muted = !save.muted;
  audio.unlock();
  audio.setMuted(save.muted);
  persist();
  renderTitle();
});
$('btn-key-labels').addEventListener('click', () => {
  save.labels = !save.labels;
  piano.setLabels(save.labels);
  persist();
  renderTitle();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all song progress?')) return;
  localStorage.removeItem(KEY);
  save = load();
  renderTitle();
});

// ---------- common ----------

function start(def, m) {
  audio.unlock();
  stop();
  song = parseSong(def);
  mode = m;
  phrase = null;
  show($('screen-title'), false);
  show($('screen-results'), false);
  show($('screen-play'), true);
  $('play-title').textContent = def.title;
  score.load(song, { labels: m === 'learn' && save.hints });
  score.resetStates();
  score.dimOutside(0, song.barCount);
  score.setOffset(0);
  score.count('');
  feedback('');
  piano.setEnabled(true);
  if (m === 'listen') setupListen();
  else if (m === 'learn') setupLearn();
  else setupPlay();
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  s = null;
}

function toTitle() {
  stop();
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

function beatsToMs(beats, speed = 1) {
  return (beats * 60000) / (song.tempo * speed);
}

function noteSeconds(e, speed = 1) {
  return Math.min(2.5, Math.max(0.35, beatsToMs(e.dur, speed) / 1000));
}

function playRange() {
  return phrase || { fromBar: 0, toBar: song.barCount };
}

function rangeEvents() {
  return eventsIn(song, playRange());
}

function phraseChips(onChange) {
  const chips = [chip('Whole song', phrase === null, () => onChange(null))];
  const phrases = phrasesOf(song);
  if (phrases.length > 1) {
    phrases.forEach((p, i) => chips.push(chip(`Part ${i + 1}`, phrase && phrase.fromBar === p.fromBar, () => onChange(p))));
  }
  return chips;
}

// ---------- listen ----------

function setupListen() {
  $('play-sub').textContent = 'Watch the notes light up as the melody plays.';
  $('play-right').textContent = '';
  setControls([...phraseChips((p) => { phrase = p; setupListen(); }), chip('▶ Play', false, startListen, 'go')]);
  score.resetStates();
  const r = playRange();
  score.dimOutside(r.fromBar, r.toBar);
  const ev = rangeEvents();
  score.setOffset(ev.length ? ev[0].t : 0);
}

function startListen() {
  const ev = rangeEvents();
  if (!ev.length) return;
  const t0 = ev[0].t;
  s = { kind: 'listen', ev, start: performance.now(), t0, next: 0, end: ev[ev.length - 1].t + ev[ev.length - 1].dur };
  score.resetStates();
  setControls([...phraseChips((p) => { phrase = p; setupListen(); }), chip('■ Stop', false, () => { stop(); setupListen(); })]);
  raf = requestAnimationFrame(listenFrame);
}

function listenFrame(now) {
  if (!s || s.kind !== 'listen') return;
  const t = s.t0 + ((now - s.start) / 60000) * song.tempo;
  score.setOffset(t);
  while (s.next < s.ev.length && s.ev[s.next].t <= t + 0.02) {
    const e = s.ev[s.next];
    const idx = song.events.indexOf(e);
    if (!e.rest) {
      audio.note(e.midi, { dur: noteSeconds(e), vol: 0.3 });
      score.setState(idx, 'current');
      piano.flash(e.pc, true);
      setTimeout(() => score.setState(idx, 'ok'), Math.max(120, beatsToMs(e.dur) * 0.8));
    }
    s.next++;
  }
  if (t > s.end + 1) {
    stop();
    setupListen();
    return;
  }
  raf = requestAnimationFrame(listenFrame);
}

// ---------- learn ----------

function setupLearn() {
  $('play-sub').textContent = 'Press the key for the blue note. No clock. Wrong keys show the name.';
  score.setLabels(save.hints);
  const r = playRange();
  score.resetStates();
  score.dimOutside(r.fromBar, r.toBar);
  const queue = rangeEvents().filter((e) => !e.rest);
  s = { kind: 'learn', queue, i: 0, firstTry: 0, tries: 0, wrongHere: 0, target: queue.length ? queue[0].t : 0, done: false };
  setControls([
    ...phraseChips((p) => { phrase = p; setupLearn(); }),
    chip(`Names: ${save.hints ? 'on' : 'off'}`, save.hints, () => { save.hints = !save.hints; persist(); setupLearn(); }),
  ]);
  score.setOffset(s.target);
  markCurrent();
  raf = requestAnimationFrame(learnFrame);
}

function markCurrent() {
  if (!s || s.i >= s.queue.length) return;
  const idx = song.events.indexOf(s.queue[s.i]);
  score.setState(idx, 'current');
  s.target = s.queue[s.i].t;
  $('play-right').textContent = `${s.i + 1} / ${s.queue.length}`;
}

function learnFrame() {
  if (!s || s.kind !== 'learn') return;
  raf = requestAnimationFrame(learnFrame);
  const cur = score.offset;
  score.setOffset(cur + (s.target - cur) * 0.18);
}

function learnKey(pc) {
  if (s.done || s.i >= s.queue.length) return;
  const e = s.queue[s.i];
  const idx = song.events.indexOf(e);
  if (pc === e.pc) {
    sound(e.midi, { dur: noteSeconds(e), vol: 0.32 });
    score.setState(idx, 'ok');
    score.hint(idx, false);
    piano.flash(pc, true);
    if (s.wrongHere === 0) s.firstTry++;
    s.tries++;
    s.wrongHere = 0;
    feedback(`${noteName(e.note)} ✓`, 'ok');
    s.i++;
    if (s.i >= s.queue.length) finishLearn();
    else markCurrent();
  } else {
    s.wrongHere++;
    s.tries++;
    audio.bad();
    piano.flash(pc, false);
    score.hint(idx, true);
    feedback(`Not quite. It is ${noteName(e.note)}.`, 'bad');
  }
}

function finishLearn() {
  s.done = true;
  const total = s.queue.length;
  const acc = total ? s.firstTry / total : 0;
  const st = starsFor(acc);
  if (phrase === null) {
    save.learn[song.id] = Math.max(save.learn[song.id] || 0, st);
    persist();
  }
  if (st === 3) audio.fanfare();
  setTimeout(() => {
    $('res-title').textContent = st === 3 ? 'Note perfect!' : st >= 1 ? 'Nice work' : 'Keep going';
    $('res-stars').innerHTML = stars(st);
    $('res-text').textContent = `${s.firstTry} of ${total} notes right first time${phrase ? ' in this part' : ''}.${phrase ? ' Stars count for the whole song.' : ''}`;
    $('btn-again').textContent = 'Learn again';
    show($('btn-res-next'), st >= 2);
    piano.setEnabled(false);
    show($('screen-play'), false);
    show($('screen-results'), true);
  }, 700);
}

// ---------- play (in time) ----------

function setupPlay() {
  $('play-sub').textContent = 'Press each key as it reaches the red line. Count-in first.';
  score.setLabels(false);
  score.resetStates();
  const r = playRange();
  score.dimOutside(r.fromBar, r.toBar);
  s = null;
  const ev = rangeEvents();
  score.setOffset(ev.length ? ev[0].t : 0);
  renderPlayControls();
  $('play-right').textContent = '';
}

function renderPlayControls(running = false) {
  const speeds = [0.5, 0.75, 1];
  const controls = [
    ...phraseChips((p) => { phrase = p; setupPlay(); }),
    ...speeds.map((sp) => chip(`${Math.round(sp * 100)}%`, save.speed === sp, () => { save.speed = sp; persist(); setupPlay(); })),
    chip(`Click: ${save.metronome ? 'on' : 'off'}`, save.metronome, () => { save.metronome = !save.metronome; persist(); renderPlayControls(running); }),
    running ? chip('■ Stop', false, () => { stop(); setupPlay(); }) : chip('▶ Start', false, startPlay, 'go'),
  ];
  setControls(controls);
}

function startPlay() {
  const ev = rangeEvents();
  if (!ev.length) return;
  const notes = ev.filter((e) => !e.rest);
  const t0 = ev[0].t;
  const countIn = song.beatsPerBar;
  // Beats are counted from the first full bar line, so clicks land on the beat.
  const grid = song.pickup ? song.pickup - song.beatsPerBar : 0;
  s = {
    kind: 'play', ev, notes, start: performance.now(), t0, countIn, grid, speed: save.speed,
    hits: 0, perfect: 0, misses: 0, wrongs: 0, lastClick: -Infinity, nextMiss: 0,
    end: ev[ev.length - 1].t + ev[ev.length - 1].dur,
  };
  score.resetStates();
  feedback('');
  renderPlayControls(true);
  raf = requestAnimationFrame(playFrame);
}

function playTime(now) {
  return s.t0 - s.countIn + ((now - s.start) / 60000) * song.tempo * s.speed;
}

function playFrame(now) {
  if (!s || s.kind !== 'play') return;
  raf = requestAnimationFrame(playFrame);
  const t = playTime(now);
  score.setOffset(t);
  // Metronome: one click per beat from the start of the count-in.
  const beat = Math.floor(t - s.grid + 1e-6);
  if (beat > s.lastClick && t - s.grid >= -s.countIn - 1e-6) {
    s.lastClick = beat;
    const strong = ((beat % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar === 0;
    if (save.metronome || t < s.t0) audio.blip(strong ? 1400 : 1000, 0.03, strong ? 0.18 : 0.1);
  }
  score.count(t < s.t0 ? String(Math.ceil(s.t0 - t)) : '');
  // Misses: notes that slipped past their window.
  while (s.nextMiss < s.notes.length && t > s.notes[s.nextMiss].t + HIT_WINDOW) {
    const e = s.notes[s.nextMiss];
    if (!e.resolved) {
      e.resolved = 'miss';
      s.misses++;
      score.setState(song.events.indexOf(e), 'miss');
    }
    s.nextMiss++;
  }
  // Highlight the next note due.
  const due = s.notes.find((e) => !e.resolved);
  if (due && due !== s.highlighted) {
    if (s.highlighted && !s.highlighted.resolved) score.setState(song.events.indexOf(s.highlighted), '');
    score.setState(song.events.indexOf(due), 'current');
    s.highlighted = due;
  }
  $('play-right').innerHTML = `<span class="ok">✓ ${s.hits}</span> &nbsp; <span class="bad">✗ ${s.misses + s.wrongs}</span>`;
  if (t > s.end + 1.5) finishPlay();
}

function playKey(pc) {
  if (!s || s.kind !== 'play') return;
  const t = playTime(performance.now());
  let best = null;
  let bestD = Infinity;
  for (const e of s.notes) {
    if (e.resolved) continue;
    const d = Math.abs(t - e.t);
    if (d <= HIT_WINDOW && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  if (best && best.pc === pc) {
    best.resolved = 'hit';
    s.hits++;
    const perfect = bestD <= PERFECT;
    if (perfect) s.perfect++;
    sound(best.midi, { dur: noteSeconds(best, s.speed), vol: 0.32 });
    score.setState(song.events.indexOf(best), 'ok');
    piano.flash(pc, true);
    feedback(perfect ? 'Perfect!' : 'Good', 'ok');
  } else {
    s.wrongs++;
    audio.bad();
    piano.flash(pc, false);
    if (best) score.hint(song.events.indexOf(best), true);
    feedback(best ? `That one is ${noteName(best.note)}` : 'Nothing due yet', 'bad');
  }
}

function finishPlay() {
  const total = s.notes.length;
  const acc = total ? Math.max(0, s.hits - s.wrongs * 0.5) / total : 0;
  const st = starsFor(acc);
  const whole = phrase === null;
  if (whole) {
    save.best[song.id] = Math.max(save.best[song.id] || 0, acc);
    if (s.speed === 1) save.play[song.id] = Math.max(save.play[song.id] || 0, st);
    persist();
  }
  const perfect = s.perfect;
  const hits = s.hits;
  const misses = s.misses;
  const wrongs = s.wrongs;
  const speed = s.speed;
  stop();
  score.count('');
  if (st === 3) audio.fanfare();
  setTimeout(() => {
    $('res-title').textContent = st === 3 ? 'You played it!' : st >= 1 ? 'Getting there' : 'Keep practising';
    $('res-stars').innerHTML = stars(st);
    $('res-text').textContent = `${hits} of ${total} notes in time (${perfect} perfect), ${misses} missed, ${wrongs} wrong keys, at ${Math.round(speed * 100)}% speed.${speed < 1 && st >= 2 ? ' Try a faster speed.' : ''}${!whole ? ' Stars count for the whole song.' : ''}`;
    $('btn-again').textContent = 'Play again';
    show($('btn-res-next'), false);
    piano.setEnabled(false);
    show($('screen-play'), false);
    show($('screen-results'), true);
  }, 600);
}

// ---------- results ----------

$('btn-again').addEventListener('click', () => start(song, mode));
$('btn-res-songs').addEventListener('click', toTitle);
$('btn-res-next').addEventListener('click', () => start(song, 'play'));

function onKey(pc) {
  audio.unlock();
  if (!s) return;
  if (s.kind === 'learn') learnKey(pc);
  else if (s.kind === 'play') playKey(pc);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && s && s.kind === 'play') {
    stop();
    setupPlay();
  }
});

renderTitle();
window.noteByNote = { score, piano, get session() { return s; }, get song() { return song; }, start, SONGS };
