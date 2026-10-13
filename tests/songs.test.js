import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, parseSong, barLengths, phrasesOf, eventsIn, LEVEL_ORDER } from '../games/note-by-note/src/songs.js';

test('every song parses and every bar adds up to the time signature', () => {
  const ids = new Set();
  for (const def of SONGS) {
    assert.ok(!ids.has(def.id), `duplicate id ${def.id}`);
    ids.add(def.id);
    assert.ok(LEVEL_ORDER.includes(def.level), `${def.id}: level ${def.level}`);
    const song = parseSong(def);
    const lens = barLengths(def);
    const bpb = song.beatsPerBar;
    lens.forEach((len, i) => {
      const first = i === 0;
      const last = i === lens.length - 1;
      if (first && song.pickup) assert.ok(Math.abs(len - song.pickup) < 1e-9, `${def.id}: pickup bar is ${len}, expected ${song.pickup}`);
      else if (last) assert.ok(len <= bpb + 1e-9 && len > 0, `${def.id}: last bar is ${len}`);
      else assert.ok(Math.abs(len - bpb) < 1e-9, `${def.id}: bar ${i + 1} is ${len} beats, expected ${bpb}`);
    });
    assert.ok(song.noteCount >= 8, `${def.id}: only ${song.noteCount} notes`);
    for (const e of song.events) {
      if (e.rest) continue;
      assert.ok(e.pos >= -6 && e.pos <= 14, `${def.id}: note at staff position ${e.pos}`);
    }
  }
});

test('bar lines land on bar starts', () => {
  for (const def of SONGS) {
    const song = parseSong(def);
    for (const x of song.barLines) {
      assert.ok(song.barStarts.some((s) => Math.abs(s - x) < 1e-9), `${def.id}: bar line at ${x} is not a bar start`);
    }
  }
});

test('phrases cover the whole song without gaps', () => {
  for (const def of SONGS) {
    const song = parseSong(def);
    const phrases = phrasesOf(song);
    assert.equal(phrases[0].fromBar, 0);
    assert.equal(phrases[phrases.length - 1].toBar, song.barCount);
    for (let i = 1; i < phrases.length; i++) assert.equal(phrases[i].fromBar, phrases[i - 1].toBar);
    const covered = phrases.reduce((n, p) => n + eventsIn(song, p).length, 0);
    assert.equal(covered, song.events.length, `${def.id}: phrases cover ${covered} of ${song.events.length} events`);
  }
});
