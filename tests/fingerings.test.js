import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINGERINGS, NOTES, LEVELS, KEYS, matches, diff, notesFor, midiOf, primary } from '../games/flute-fingers/src/fingerings.js';

test('every fingering only uses real keys and every level only real notes', () => {
  const ids = new Set(KEYS.map((k) => k.id));
  for (const [note, alts] of Object.entries(FINGERINGS)) {
    for (const alt of alts) for (const k of alt) assert.ok(ids.has(k), `${note}: unknown key ${k}`);
  }
  for (const lv of LEVELS) for (const n of lv.notes) assert.ok(FINGERINGS[n], `${lv.id}: no fingering for ${n}`);
});

test('notes are listed from low to high, a semitone apart', () => {
  for (let i = 1; i < NOTES.length; i++) assert.equal(midiOf(NOTES[i]) - midiOf(NOTES[i - 1]), 1, `${NOTES[i - 1]} → ${NOTES[i]}`);
});

test('the second octave repeats the first except D, and low C/C♯/D are the only notes without the E♭ key', () => {
  for (const n of ['E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']) assert.deepEqual(primary(`${n}5`), primary(`${n}4`), n);
  assert.deepEqual(primary('Eb5'), primary('Eb4'));
  assert.notDeepEqual(primary('D5'), primary('D4'));
  for (const n of NOTES) {
    const hasEb = primary(n).includes('Eb');
    assert.equal(hasEb, !['C4', 'C#4', 'D4'].includes(n), `${n} E♭ key`);
  }
});

test('matching accepts alternatives and the C roller implies C♯', () => {
  assert.ok(matches('Bb4', ['T', 'L1', 'R1', 'Eb']));
  assert.ok(matches('Bb4', ['Tb', 'L1', 'Eb']));
  assert.ok(!matches('Bb4', ['T', 'L1', 'Eb']), 'that is B');
  assert.ok(matches('C4', ['T', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'Cs', 'C']));
  assert.deepEqual(notesFor(['T', 'L1', 'Eb']), ['B4', 'B5']);
  assert.deepEqual(notesFor(['L1', 'Eb']), ['C5', 'C6']);
  const d = diff('F#4', ['T', 'L1', 'L2', 'L3', 'R1', 'Eb']);
  assert.deepEqual(d.missing, ['R3']);
  assert.deepEqual(d.extra, ['R1']);
});
