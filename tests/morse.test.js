import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MORSE, KOCH, encode, decode, timing, schedule, lessonChars, keyedToCode, wordsFrom, LESSON_COUNT } from '../games/morse-ear/src/morse.js';

test('the table round-trips and Koch covers every letter and digit', () => {
  const text = 'THE QUICK BROWN FOX JUMPS OVER 13 LAZY DOGS, OK?';
  assert.equal(decode(encode(text)), text);
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') assert.ok(KOCH.includes(c), `Koch lacks ${c}`);
  assert.equal(new Set(KOCH).size, KOCH.length);
  for (const c of KOCH) assert.ok(MORSE[c], `no code for ${c}`);
  assert.deepEqual(lessonChars(1), ['K', 'M']);
  assert.equal(lessonChars(LESSON_COUNT).length, KOCH.length);
});

test('timing follows PARIS and Farnsworth stretches only the gaps', () => {
  const t = timing(20);
  assert.ok(Math.abs(t.dit - 60) < 1e-9);
  assert.equal(t.dah, 3 * t.dit);
  const f = timing(20, 10);
  assert.equal(f.dit, t.dit);
  assert.ok(f.charGap > t.charGap);
  // PARIS at 20/10 should take about 6 seconds (10 words per minute).
  const s = schedule('PARIS', 20, 10);
  const last = s.tones[s.tones.length - 1];
  const wordMs = last.at + last.dur + f.wordGap;
  assert.ok(Math.abs(wordMs - 6000) < 60, `PARIS took ${wordMs} ms`);
});

test('hand keying decodes dits, dahs, letter and word gaps', () => {
  const u = 100;
  // "E T" then "/" then "A": . (gap) - / .-
  const ev = [
    { down: 0, up: 90 },
    { down: 400, up: 700 },
    { down: 1400, up: 1490 },
    { down: 1590, up: 1900 },
  ];
  assert.equal(keyedToCode(ev, u), '. - / .-');
  assert.equal(decode(keyedToCode(ev, u)), 'ET A');
});

test('words mode only uses learned characters', () => {
  const words = wordsFrom(lessonChars(8)); // K M R S U A P T L
  assert.ok(words.length >= 5, `only ${words.length} words`);
  for (const w of words) for (const c of w) assert.ok('KMRSUAPTL'.includes(c));
});
