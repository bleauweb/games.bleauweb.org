// A chromatic tuner. Pitch detection lives in /shared/pitch.js; the flute drawing and chart
// come from the Flute Fingers game.
import { PitchListener, midiName, midiToFreq } from '/shared/pitch.js';
import { FluteDiagram } from '../../../games/flute-fingers/src/flute.js';
import { FINGERINGS, primary } from '../../../games/flute-fingers/src/fingerings.js';

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

// ---------- dial ----------
const dial = $('dial');
const CX = 200;
const CY = 210;
const R = 170;
const SPAN = 60; // degrees either side for ±50 cents
function polar(deg, r) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
function arc(from, to, r) {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
}
dial.append(el('path', { d: arc(-SPAN, SPAN, R), class: 'arc' }));
dial.append(el('path', { d: arc(-SPAN * 0.1, SPAN * 0.1, R), class: 'arc green' }));
for (let c = -50; c <= 50; c += 10) {
  const deg = (c / 50) * SPAN;
  const major = c % 50 === 0 || c === 0;
  const [x1, y1] = polar(deg, R - 14);
  const [x2, y2] = polar(deg, R + (major ? 14 : 9));
  dial.append(el('line', { x1, y1, x2, y2, class: major ? 'tick major' : 'tick' }));
  if (c % 25 === 0) {
    const [tx, ty] = polar(deg, R + 30);
    const t = el('text', { x: tx, y: ty + 4, class: 'lbl' });
    t.textContent = c === 0 ? '0' : `${c > 0 ? '+' : ''}${c}`;
    dial.append(t);
  }
}
const needle = el('line', { x1: CX, y1: CY, x2: CX, y2: CY - R + 6, class: 'needle' });
dial.append(needle, el('circle', { cx: CX, cy: CY, r: 9, class: 'hub' }));

let shownCents = 0;
function setNeedle(cents, inTune) {
  const c = Math.max(-50, Math.min(50, cents));
  shownCents += (c - shownCents) * 0.35;
  needle.setAttribute('transform', `rotate(${(shownCents / 50) * SPAN} ${CX} ${CY})`);
  needle.classList.toggle('in-tune', inTune);
}

// ---------- flute ----------
const flute = new FluteDiagram($('flute'), { interactive: false });
const FLUTE_KEYS = Object.keys(FINGERINGS);
function fluteKeyFor(midi) {
  const name = midiName(midi).replace('♯', '#').replace('♭', 'b');
  if (FINGERINGS[name]) return name;
  // The chart spells C♯ E♭ F♯ G♯ B♭; nothing else is needed, but be safe.
  return FLUTE_KEYS.find((k) => midiToFreq(midi) && k === name) || null;
}

// ---------- listening ----------
let a4 = 440;
let held = 0;
let lastMidi = null;
const listener = new PitchListener({
  a4,
  minClarity: 0.88,
  onPitch: (p) => {
    if (p.nearest === null) {
      if (++held > 20) {
        $('note').textContent = '—';
        $('note').classList.remove('in-tune');
        $('cents').textContent = 'play a note';
        $('cents').className = 'cents';
        $('hz').textContent = '';
        $('advice').textContent = '';
        setNeedle(0, false);
      }
      return;
    }
    held = 0;
    const inTune = Math.abs(p.cents) <= 5;
    $('note').textContent = midiName(p.nearest);
    $('note').classList.toggle('in-tune', inTune);
    $('cents').textContent = inTune ? 'in tune' : `${p.cents > 0 ? '+' : ''}${Math.round(p.cents)} cents ${p.cents > 0 ? 'sharp' : 'flat'}`;
    $('cents').className = `cents ${inTune ? 'in-tune' : p.cents > 0 ? 'sharp' : 'flat'}`;
    $('hz').textContent = `${p.freq.toFixed(1)} Hz · target ${midiToFreq(p.nearest, a4).toFixed(1)} Hz`;
    $('advice').textContent = inTune ? '' : Math.abs(p.cents) > 25 ? (p.cents > 0 ? 'Quite sharp: pull the head joint out a little, or roll in.' : 'Quite flat: push the head joint in a little, or roll out.') : p.cents > 0 ? 'A touch sharp: relax the air, roll in slightly.' : 'A touch flat: more air support, roll out slightly.';
    setNeedle(p.cents, inTune);
    if (p.nearest !== lastMidi) {
      lastMidi = p.nearest;
      const key = fluteKeyFor(p.nearest);
      if (key) {
        flute.setPressed(primary(key));
        $('flute-note').textContent = `${midiName(p.nearest)} fingering`;
      } else {
        flute.clear();
        $('flute-note').textContent = `${midiName(p.nearest)} is outside the two-octave chart`;
      }
    }
  },
  onState: (st) => {
    const b = $('btn-start');
    b.textContent = st === 'on' ? 'Stop listening' : 'Start listening';
    b.classList.toggle('on', st === 'on');
  },
});

$('btn-start').addEventListener('click', async () => {
  try {
    if (listener.running) listener.stop();
    else await listener.start();
  } catch (e) {
    $('advice').textContent = e.message || 'Could not start the microphone.';
  }
});
$('a4').addEventListener('change', () => {
  a4 = Number($('a4').value);
  listener.setA4(a4);
});
$('show-flute').addEventListener('change', () => {
  $('flute-card').style.display = $('show-flute').checked ? '' : 'none';
});

// ---------- reference tone ----------
const toneSel = $('tone-note');
for (let m = 60; m <= 84; m++) {
  const o = document.createElement('option');
  o.value = m;
  o.textContent = midiName(m);
  if (m === 69) o.selected = true;
  toneSel.append(o);
}
let toneCtx = null;
let osc = null;
let gain = null;
function stopTone() {
  if (!osc) return;
  const t = toneCtx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  osc.stop(t + 0.2);
  osc = null;
  $('btn-tone').textContent = '▶ Play';
  $('btn-tone').classList.remove('on');
}
$('btn-tone').addEventListener('click', () => {
  if (osc) return stopTone();
  const AC = window.AudioContext || window.webkitAudioContext;
  toneCtx = toneCtx || new AC();
  if (toneCtx.state === 'suspended') toneCtx.resume();
  osc = toneCtx.createOscillator();
  gain = toneCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(Number(toneSel.value), a4);
  gain.gain.setValueAtTime(0.0001, toneCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, toneCtx.currentTime + 0.05);
  osc.connect(gain).connect(toneCtx.destination);
  osc.start();
  $('btn-tone').textContent = '■ Stop';
  $('btn-tone').classList.add('on');
  return undefined;
});
toneSel.addEventListener('change', () => {
  if (osc) osc.frequency.value = midiToFreq(Number(toneSel.value), a4);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTone();
    if (listener.running) listener.stop();
  }
});
window.fluteTuner = { listener, flute, setNeedle };
