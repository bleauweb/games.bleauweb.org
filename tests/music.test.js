import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, parseNote, staffPos, ledgerLines, noteAt, midi, pitchClass, pickItem, isCorrect, noteKey, freq } from '../games/treble-maker/src/music.js';

test('positions: treble lines are E G B D F, spaces F A C E', () => {
  assert.deepEqual(['E4', 'G4', 'B4', 'D5', 'F5'].map((s) => staffPos(parseNote(s), 'treble')), [0, 2, 4, 6, 8]);
  assert.deepEqual(['F4', 'A4', 'C5', 'E5'].map((s) => staffPos(parseNote(s), 'treble')), [1, 3, 5, 7]);
  assert.deepEqual(['G2', 'B2', 'D3', 'F3', 'A3'].map((s) => staffPos(parseNote(s), 'bass')), [0, 2, 4, 6, 8]);
  assert.equal(staffPos(parseNote('C4'), 'treble'), -2, 'middle C is one ledger line below treble');
  assert.equal(staffPos(parseNote('C4'), 'bass'), 10, 'middle C is one ledger line above bass');
});

test('ledger lines', () => {
  assert.deepEqual(ledgerLines(-2), [-2]);
  assert.deepEqual(ledgerLines(-3), [-2]);
  assert.deepEqual(ledgerLines(-4), [-2, -4]);
  assert.deepEqual(ledgerLines(10), [10]);
  assert.deepEqual(ledgerLines(12), [10, 12]);
  assert.deepEqual(ledgerLines(4), []);
});

test('noteAt inverts staffPos', () => {
  for (const clef of ['treble', 'bass']) {
    for (let p = -8; p <= 16; p++) assert.equal(staffPos(noteAt(p, clef), clef), p);
  }
  assert.equal(noteKey(noteAt(-2, 'treble')), 'C4');
});

test('pitches', () => {
  assert.equal(midi(parseNote('A4')), 69);
  assert.equal(midi(parseNote('C4')), 60);
  assert.equal(midi(parseNote('Bb3')), 58);
  assert.equal(pitchClass(parseNote('A#4')), pitchClass(parseNote('Bb4')));
  assert.ok(Math.abs(freq(69) - 440) < 1e-9);
});

test('every level note stays within a readable range (at most two ledger lines)', () => {
  for (const level of LEVELS) {
    assert.ok(level.items.length >= 4, `${level.id} too small`);
    for (const it of level.items) {
      const p = staffPos(it.note, it.clef);
      assert.ok(p >= -4 && p <= 12, `${level.id}: ${noteKey(it.note)} on ${it.clef} is at ${p}`);
    }
  }
});

test('picking favours missed notes and never repeats the last one', () => {
  const level = LEVELS[0];
  const stats = { 'treble:B4': { seen: 10, wrong: 10 } };
  let b = 0;
  let last = null;
  for (let i = 0; i < 400; i++) {
    const it = pickItem(level, stats, Math.random, last);
    const key = `${it.clef}:${noteKey(it.note)}`;
    assert.notEqual(key, last);
    if (key === 'treble:B4') b++;
    last = key;
  }
  assert.ok(b > 100, `B4 came up only ${b} times`);
  assert.ok(isCorrect({ note: parseNote('F#4') }, pitchClass(parseNote('Gb4'))));
});
