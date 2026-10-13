import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES, REGIONS, LEVELS, countriesFor, flag } from '../games/capitals/src/data.js';
import { makeQuestion, MODES, pickCountry } from '../games/capitals/src/quiz.js';

test('country data is clean', () => {
  assert.ok(COUNTRIES.length >= 120, `${COUNTRIES.length} countries`);
  const names = new Set();
  const codes = new Set();
  for (const c of COUNTRIES) {
    assert.match(c.code, /^[A-Z]{2}$/, c.name);
    assert.ok(!codes.has(c.code) && !names.has(c.name), `duplicate ${c.name}`);
    codes.add(c.code);
    names.add(c.name);
    assert.ok(c.capital.length > 1, `${c.name} capital`);
    assert.ok(REGIONS.includes(c.region), `${c.name} region ${c.region}`);
  }
  assert.equal(flag('FR'), '🇫🇷');
  for (const lv of LEVELS) assert.ok(countriesFor(lv).length >= 4, `${lv.id} too small`);
});

test('questions have four distinct options including the answer, same region first', () => {
  let seed = 3;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (const lv of LEVELS) {
    for (const modeId of Object.keys(MODES)) {
      for (let i = 0; i < 20; i++) {
        const q = makeQuestion(lv, modeId, {}, rng);
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options.map((o) => o.label)).size, 4, `${lv.id}/${modeId}: duplicate options`);
        assert.ok(q.options.some((o) => o.code === q.target.code && o.label === q.answer));
        const region = q.target.region;
        const sameRegion = q.options.filter((o) => COUNTRIES.find((c) => c.code === o.code).region === region).length;
        assert.ok(sameRegion >= 2, `${lv.id}/${modeId}: distractors should come from ${region}`);
      }
    }
  }
});

test('missed countries come back more often and never twice in a row', () => {
  const pool = countriesFor(LEVELS[0]);
  const stats = { FR: { seen: 10, wrong: 10 } };
  let fr = 0;
  let last = null;
  for (let i = 0; i < 500; i++) {
    const c = pickCountry(pool, stats, Math.random, last);
    assert.notEqual(c.code, last);
    if (c.code === 'FR') fr++;
    last = c.code;
  }
  assert.ok(fr > 22, `France came up ${fr} times (about 13 would be chance)`);
});
