import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, freqToMidi, midiName, centsOff } from '../shared/pitch.js';

function tone(freq, sampleRate = 48000, n = 2048, harmonics = [1]) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((amp, k) => {
      v += amp * Math.sin((2 * Math.PI * freq * (k + 1) * i) / sampleRate);
    });
    buf[i] = v * 0.3;
  }
  return buf;
}

test('finds a pure tone within a few cents', () => {
  for (const f of [261.63, 440, 587.33, 1046.5, 1975.5]) {
    const r = detectPitch(tone(f), 48000);
    assert.ok(Math.abs(centsOff(r.freq, Math.round(freqToMidi(f)))) < 5, `${f} Hz detected as ${r.freq.toFixed(2)}`);
    assert.ok(r.clarity > 0.95);
  }
});

test('does not jump an octave when the second harmonic is loud (a flute-like tone)', () => {
  const r = detectPitch(tone(293.66, 48000, 2048, [0.6, 1.0, 0.4, 0.2]), 48000);
  assert.equal(midiName(freqToMidi(r.freq)), 'D4');
});

test('silence and noise report no pitch', () => {
  assert.equal(detectPitch(new Float32Array(2048), 48000).freq, 0);
  const noise = new Float32Array(2048);
  let seed = 7;
  for (let i = 0; i < noise.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    noise[i] = (seed / 0x7fffffff - 0.5) * 0.4;
  }
  const r = detectPitch(noise, 48000);
  assert.ok(r.freq === 0 || r.clarity < 0.9, `noise had clarity ${r.clarity}`);
});

test('names and cents', () => {
  assert.equal(midiName(69), 'A4');
  assert.equal(midiName(60), 'C4');
  assert.equal(midiName(61), 'C♯4');
  assert.ok(Math.abs(centsOff(442, 69) - 7.85) < 0.1);
});
