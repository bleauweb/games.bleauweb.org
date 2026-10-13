import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../games/forecaster/src/forecast.js';

/** A starter forecaster: persistence (tomorrow = today) with the coarse thermometer. */
function naive(obs) {
  return { condition: obs.condition, temp: obs.temp, wind: obs.wind || 'calm' };
}
/** A fully equipped forecaster who trusts the national model but checks it against radar and the system's position. */
function expert(obs) {
  let { condition, temp, wind } = obs.model;
  if (obs.radar === 'clear within a day' && (condition === 'rain' || condition === 'snow')) condition = obs.front === 'passed' ? 'sunny' : 'cloudy';
  if (obs.radar === 'precipitation approaching' && condition !== 'rain' && condition !== 'snow') condition = temp <= 1 ? 'snow' : 'rain';
  if (obs.front === 'passed' && condition === 'cloudy' && obs.humidity < 70) condition = 'sunny';
  return { condition, temp, wind };
}

function run(seed, strategy, gear, days) {
  const s = F.newGame(seed);
  for (const [k, v] of Object.entries(gear)) s.gear[k] = v;
  let perfect = 0;
  let total = 0;
  for (let i = 0; i < days && !s.won; i++) {
    const r = F.submit(s, strategy(F.observations(s)));
    total += r.score.total;
    if (r.score.total === F.PERFECT) perfect++;
  }
  return { s, perfect, avg: total / Math.max(1, s.day - 1) };
}

const FULL = { thermometer: 2, almanac: 1, barometer: 2, hygrometer: 1, anemometer: 1, neighbours: 2, satellite: 1, radar: 1, model: 3 };

test('starter gear makes a perfect day rare; full gear makes it common', () => {
  const a = run(11, naive, {}, 300);
  const b = run(11, expert, FULL, 300);
  const rateA = a.perfect / 300;
  const rateB = b.perfect / Math.max(1, b.s.day - 1);
  assert.ok(rateA < 0.25, `starter perfect rate ${rateA.toFixed(2)} should be rare`);
  assert.ok(rateB > 0.7, `expert perfect rate ${rateB.toFixed(2)} should be common`);
});

test('a fully equipped forecaster wins within a season on every seed', () => {
  for (const seed of [1, 2, 3, 42, 777, 31337]) {
    const { s } = run(seed, expert, FULL, 200);
    assert.ok(s.won, `seed ${seed}: best streak ${s.bestStreak} in ${s.day} days`);
    assert.ok(s.wonDay <= 120, `seed ${seed}: took ${s.wonDay} days`);
  }
});

test('starter gear never wins quickly and can afford all the gear in a reasonable time', () => {
  const { s } = run(5, naive, {}, 200);
  assert.ok(!s.won || s.wonDay > 40, `naive won on day ${s.wonDay}`);
  assert.ok(s.points > F.totalGearCost() * 0.6, `after 200 naive days the player has ${s.points} points; all gear costs ${F.totalGearCost()}`);
});

test('scoring and gear', () => {
  const actual = { condition: 'rain', temp: 10, wind: 'breezy' };
  assert.equal(F.score({ condition: 'rain', temp: 11, wind: 'breezy' }, actual).total, 100);
  assert.equal(F.score({ condition: 'rain', temp: 13, wind: 'calm' }, actual).total, 70);
  assert.equal(F.score({ condition: 'sunny', temp: 20, wind: 'calm' }, actual).total, 0);
  const s = F.newGame(1);
  s.points = 1000;
  assert.ok(F.buyGear(s, 'thermometer'));
  assert.equal(s.gear.thermometer, 2);
  assert.ok(!F.buyGear(s, 'thermometer'), 'no third level');
  const obs = F.observations(s);
  assert.equal(obs.tempCoarse, false);
  assert.ok(F.CONDITIONS.includes(obs.condition));
});
