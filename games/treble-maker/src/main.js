// Screens and modes. Music rules live in music.js, drawing in staff.js, keys in piano.js.
import { LEVELS, pickItem, isCorrect, noteKey, noteName, midi, starsFor, PASS_FRACTION, parseNote, pitchClass, CLEFS } from './music.js';
import { Staff, W, HIT_X, NOTE_X } from './staff.js';
import { Piano } from './piano.js';
import { audio } from './audio.js';
import { loadSave, writeSave, resetSave } from './save.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const PRACTICE_ROUNDS = 12;

let save = loadSave();
let level = LEVELS[0];
let mode = 'learn'; // learn | practice | rush
let session = null;
let feedbackTimer = 0;

const staff = new Staff($('staff'));
const piano = new Piano($('piano'), { onKey: onAnswer, labels: save.labels });
audio.setMuted(save.muted);

// ---------- title ----------

function stars(n) {
  let s = '';
  for (let i = 1; i <= 3; i++) s += `<span class="${i <= n ? '' : 'dim'}">★</span>`;
  return s;
}

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const open = i < save.unlocked;
    const row = document.createElement('div');
    row.className = 'level' + (open ? '' : ' locked');
    const best = save.best[lv.id];
    row.innerHTML = `
      <div class="name">${i + 1}. ${lv.name}</div>
      <div class="meta"><span class="stars">${stars(save.stars[lv.id] || 0)}</span>${best ? ` · rush best ${best}` : ''}${open ? '' : ' · pass the level before'}</div>
      <div class="modes">
        <button class="mode-btn learn" ${open ? '' : 'disabled'}>Learn</button>
        <button class="mode-btn practice" ${open ? '' : 'disabled'}>Practice</button>
        <button class="mode-btn rush" ${open ? '' : 'disabled'}>Rush</button>
      </div>`;
    const [l, p, r] = row.querySelectorAll('button');
    l.addEventListener('click', () => start(lv, 'learn'));
    p.addEventListener('click', () => start(lv, 'practice'));
    r.addEventListener('click', () => start(lv, 'rush'));
    list.append(row);
  });
  $('btn-mute').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
  $('btn-labels').textContent = `Key names: ${save.labels ? 'on' : 'off'}`;
}

$('btn-mute').addEventListener('click', () => {
  save.muted = !save.muted;
  audio.unlock();
  audio.setMuted(save.muted);
  writeSave(save);
  renderTitle();
});
$('btn-labels').addEventListener('click', () => {
  save.labels = !save.labels;
  piano.setLabels(save.labels);
  writeSave(save);
  renderTitle();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress and statistics?')) return;
  save = resetSave();
  piano.setLabels(save.labels);
  renderTitle();
});

// ---------- common ----------

function levelClef(lv) {
  const clefs = new Set(lv.items.map((it) => it.clef));
  return clefs.size === 1 ? lv.items[0].clef : 'treble';
}

function start(lv, m) {
  audio.unlock();
  level = lv;
  mode = m;
  clearTimeout(feedbackTimer);
  staff.clear();
  staff.caption('');
  staff.showHitLine(false);
  show($('screen-title'), false);
  show($('screen-results'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('tip').textContent = lv.tip;
  show($('learn-controls'), m === 'learn');
  piano.setEnabled(true);
  if (m === 'learn') startLearn();
  else if (m === 'practice') startPractice();
  else startRush();
}

function record(item, ok) {
  const key = `${item.clef}:${noteKey(item.note)}`;
  const s = save.stats[key] || { seen: 0, wrong: 0 };
  s.seen++;
  if (!ok) s.wrong++;
  save.stats[key] = s;
}

function toTitle() {
  stopRush();
  show($('screen-play'), false);
  show($('screen-results'), false);
  renderTitle();
  show($('screen-title'), true);
}
$('btn-close').addEventListener('click', toTitle);

// ---------- learn ----------

let learnClef = 'treble';
let learnLabels = true;

function startLearn() {
  learnClef = levelClef(level);
  learnLabels = true;
  staff.setClef(learnClef);
  staff.setLabels(true);
  $('btn-clef').textContent = `Clef: ${CLEFS[learnClef].name}`;
  $('btn-staff-labels').textContent = 'Names on staff: on';
  $('play-sub').textContent = 'Tap a key to see where that note lives. Tap "Show me a note" to quiz yourself.';
  $('play-right').textContent = '';
  session = { quiz: null };
}

$('btn-clef').addEventListener('click', () => {
  learnClef = learnClef === 'treble' ? 'bass' : 'treble';
  staff.setClef(learnClef);
  staff.clear();
  staff.caption('');
  $('btn-clef').textContent = `Clef: ${CLEFS[learnClef].name}`;
});
$('btn-staff-labels').addEventListener('click', () => {
  learnLabels = !learnLabels;
  staff.setLabels(learnLabels);
  $('btn-staff-labels').textContent = `Names on staff: ${learnLabels ? 'on' : 'off'}`;
});
$('btn-random').addEventListener('click', () => {
  const pool = level.items.filter((it) => it.clef === learnClef);
  const item = pickItem({ items: pool.length ? pool : level.items }, save.stats);
  if (item.clef !== learnClef) {
    learnClef = item.clef;
    staff.setClef(learnClef);
    $('btn-clef').textContent = `Clef: ${CLEFS[learnClef].name}`;
  }
  staff.clear();
  staff.caption('Which note is this?');
  session.quiz = staff.addNote(item, NOTE_X);
});

// In learn mode a key shows that note on the staff (closest octave to the staff's middle).
function learnKey(pc) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  if (session.quiz) {
    const q = session.quiz;
    const ok = isCorrect(q.item, pc);
    staff.mark(q, ok);
    staff.caption(ok ? `${noteName(q.item.note)} ✓` : `✗ That was ${noteName(q.item.note)}`, ok ? 'ok' : 'bad');
    piano.flash(pc, ok);
    audio.note(midi(q.item.note));
    record(q.item, ok);
    writeSave(save);
    session.quiz = null;
    return;
  }
  const octave = learnClef === 'treble' ? (pc >= 9 ? 4 : 4) : pc >= 9 ? 2 : 3;
  const note = parseNote(`${names[pc]}${learnClef === 'treble' ? (pc < 4 ? 5 : octave) : octave}`);
  const item = { clef: learnClef, note };
  staff.clear();
  staff.caption('');
  staff.addNote(item, NOTE_X, { label: noteName(note) });
  audio.note(midi(note), { vol: 0.3 });
}

// ---------- practice ----------

function startPractice() {
  session = { i: 0, correct: 0, misses: [], current: null, last: null, busy: false, t0: performance.now() };
  $('play-sub').textContent = 'Name the note. No clock, no lives.';
  staff.setLabels(false);
  nextPractice();
}

function nextPractice() {
  staff.clear();
  staff.caption('');
  if (session.i >= PRACTICE_ROUNDS) return finishPractice();
  const item = pickItem(level, save.stats, Math.random, session.last);
  session.last = `${item.clef}:${noteKey(item.note)}`;
  staff.setClef(item.clef);
  session.current = staff.addNote(item, NOTE_X);
  session.busy = false;
  $('play-right').textContent = `${session.i + 1} / ${PRACTICE_ROUNDS}`;
}

function practiceKey(pc) {
  if (session.busy || !session.current) return;
  session.busy = true;
  const h = session.current;
  const ok = isCorrect(h.item, pc);
  staff.mark(h, ok);
  piano.flash(pc, ok);
  audio.note(midi(h.item.note));
  if (ok) {
    session.correct++;
    staff.caption(`${noteName(h.item.note)} ✓`, 'ok');
    audio.good();
  } else {
    session.misses.push(h.item);
    staff.caption(`✗ That was ${noteName(h.item.note)}`, 'bad');
    audio.bad();
  }
  record(h.item, ok);
  session.i++;
  feedbackTimer = setTimeout(nextPractice, ok ? 650 : 1400);
}

function finishPractice() {
  const { correct, misses, t0 } = session;
  const secs = Math.round((performance.now() - t0) / 1000);
  const st = starsFor(correct, PRACTICE_ROUNDS);
  save.stars[level.id] = Math.max(save.stars[level.id] || 0, st);
  const idx = LEVELS.indexOf(level);
  const passed = correct / PRACTICE_ROUNDS >= PASS_FRACTION;
  let unlocked = false;
  if (passed && idx + 1 < LEVELS.length && save.unlocked <= idx + 1) {
    save.unlocked = idx + 2;
    unlocked = true;
  }
  writeSave(save);
  $('res-title').textContent = st === 3 ? 'Perfect ear… eye!' : passed ? 'Passed' : 'Keep at it';
  $('res-stars').innerHTML = stars(st);
  $('res-text').textContent = `${correct} of ${PRACTICE_ROUNDS} right in ${secs}s.${passed ? '' : ` You need ${Math.ceil(PASS_FRACTION * PRACTICE_ROUNDS)} to pass.`}${unlocked ? ' Next level unlocked!' : ''}`;
  showMisses(misses);
  show($('btn-next-level'), passed && idx + 1 < LEVELS.length);
  $('btn-again').textContent = 'Practice again';
  if (st === 3) audio.fanfare();
  showResults();
}

function showMisses(misses) {
  const box = $('res-misses');
  box.innerHTML = '';
  const seen = new Set();
  for (const it of misses) {
    const key = `${it.clef}:${noteKey(it.note)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const chip = document.createElement('span');
    chip.className = 'miss';
    chip.textContent = `${noteName(it.note)} (${CLEFS[it.clef].name.toLowerCase()})`;
    box.append(chip);
  }
  if (misses.length) {
    const lead = document.createElement('div');
    lead.className = 'muted';
    lead.style.width = '100%';
    lead.textContent = 'Missed notes come back more often:';
    box.prepend(lead);
  }
}

function showResults() {
  piano.setEnabled(false);
  show($('screen-play'), false);
  show($('screen-results'), true);
}

$('btn-again').addEventListener('click', () => start(level, mode));
$('btn-res-menu').addEventListener('click', toTitle);
$('btn-next-level').addEventListener('click', () => {
  const idx = LEVELS.indexOf(level);
  start(LEVELS[Math.min(idx + 1, LEVELS.length - 1)], 'practice');
});

// ---------- rush ----------

let raf = 0;

function startRush() {
  staff.setLabels(false);
  staff.setClef(levelClef(level));
  staff.showHitLine(true);
  session = { notes: [], score: 0, combo: 0, lives: 3, speed: 55, spawnIn: 0.4, last: null, t: performance.now(), over: false };
  $('play-sub').textContent = 'Name each note before it reaches the red line.';
  renderRushHud();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(rushFrame);
}

function renderRushHud() {
  $('play-right').innerHTML = `<span class="score">${session.score}</span> &nbsp; <span class="lives">${'♥'.repeat(session.lives)}${'♡'.repeat(3 - session.lives)}</span>`;
}

function stopRush() {
  cancelAnimationFrame(raf);
  raf = 0;
}

function rushFrame(now) {
  if (mode !== 'rush' || !session || session.over) return;
  raf = requestAnimationFrame(rushFrame);
  session.frames = (session.frames || 0) + 1;
  const dt = Math.min(0.05, (now - session.t) / 1000);
  session.t = now;
  const s = session;
  s.spawnIn -= dt;
  const lastX = s.notes.length ? s.notes[s.notes.length - 1].x : -Infinity;
  if (s.spawnIn <= 0 && lastX < W - 150) {
    const item = pickItem(level, save.stats, Math.random, s.last);
    s.last = `${item.clef}:${noteKey(item.note)}`;
    // Grand-staff levels switch clef only when the staff is empty, so a note never changes meaning mid-flight.
    if (item.clef !== staff.clef && s.notes.length === 0) staff.setClef(item.clef);
    const it = item.clef === staff.clef ? item : pickItem({ items: level.items.filter((x) => x.clef === staff.clef) }, save.stats, Math.random, s.last);
    s.notes.push(staff.addNote(it, W + 20));
    s.spawnIn = 1.1 + Math.random() * 0.5;
  }
  for (const h of s.notes) staff.moveNote(h, h.x - s.speed * dt);
  s.notes.forEach((h, i) => staff.setActive(h, i === 0));
  if (s.notes.length && s.notes[0].x <= HIT_X) {
    const h = s.notes.shift();
    staff.mark(h, false);
    staff.caption(`Too slow: ${noteName(h.item.note)}`, 'bad');
    audio.bad();
    record(h.item, false);
    setTimeout(() => staff.removeNote(h), 300);
    loseLife();
  }
}

function rushKey(pc) {
  const s = session;
  if (!s.notes.length || s.over) return;
  const h = s.notes.shift();
  const ok = isCorrect(h.item, pc);
  staff.mark(h, ok);
  piano.flash(pc, ok);
  audio.note(midi(h.item.note), { dur: 0.8 });
  record(h.item, ok);
  if (ok) {
    s.combo++;
    s.score += 10 + Math.min(40, s.combo * 2);
    s.speed = Math.min(230, s.speed * 1.035);
    staff.caption(`${noteName(h.item.note)} ✓${s.combo >= 5 ? `  ×${s.combo}` : ''}`, 'ok');
    audio.good();
    setTimeout(() => staff.removeNote(h), 150);
  } else {
    s.combo = 0;
    staff.caption(`✗ That was ${noteName(h.item.note)}`, 'bad');
    audio.bad();
    setTimeout(() => staff.removeNote(h), 400);
    loseLife();
  }
  renderRushHud();
}

function loseLife() {
  const s = session;
  s.lives--;
  renderRushHud();
  if (s.lives <= 0) {
    s.over = true;
    stopRush();
    for (const h of s.notes) staff.removeNote(h);
    s.notes = [];
    const best = save.best[level.id] || 0;
    const newBest = s.score > best;
    save.best[level.id] = Math.max(best, s.score);
    writeSave(save);
    setTimeout(() => {
      $('res-title').textContent = newBest ? 'New best!' : 'Rush over';
      $('res-stars').innerHTML = '';
      $('res-text').textContent = `Score ${s.score}.${newBest ? '' : ` Best ${best}.`} Notes you missed will come back more often.`;
      $('res-misses').innerHTML = '';
      show($('btn-next-level'), false);
      $('btn-again').textContent = 'Rush again';
      showResults();
    }, 700);
  }
}

// ---------- answer routing ----------

function onAnswer(pc) {
  audio.unlock();
  if (mode === 'learn') learnKey(pc);
  else if (mode === 'practice') practiceKey(pc);
  else rushKey(pc);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'rush' && session && !session.over) toTitle();
});

renderTitle();
window.trebleMaker = { staff, piano, get session() { return session; }, get mode() { return mode; }, start, LEVELS };
