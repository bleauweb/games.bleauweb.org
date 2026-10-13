import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, parseRoom, runSequence } from '../games/gate-rush/src/pins.js';
import { ROOMS } from '../games/gate-rush/src/rooms.js';

test('every treasure room has a solution and a way to get it wrong', () => {
  const ids = new Set();
  for (const def of ROOMS) {
    assert.ok(!ids.has(def.id), `duplicate room id ${def.id}`);
    ids.add(def.id);
    const { start, solution, canFail } = analyse(def);
    assert.ok(start.pins.length >= 1 && start.pins.length <= 6, `${def.id}: ${start.pins.length} pins`);
    assert.ok(start.goldTotal >= 1, `${def.id}: no gold`);
    assert.ok(solution, `${def.id}: no pin order collects all the gold with the hero alive`);
    assert.ok(canFail, `${def.id}: every order works, so it is not a puzzle`);
  }
});

test('first room: gold pin alone wins, lava pin kills', () => {
  const start = parseRoom(ROOMS[0]);
  const good = runSequence(start, [0]);
  assert.equal(good.gold, 1);
  assert.ok(good.hero.alive);
  const bad = runSequence(start, [1]);
  assert.ok(!bad.hero.alive);
});

test('water turns lava to stone', () => {
  const start = parseRoom(ROOMS[1]);
  const quenched = runSequence(start, [0, 1, 2]);
  assert.ok(quenched.hero.alive);
  assert.equal(quenched.gold, 1);
  const burned = runSequence(start, [1]);
  assert.ok(!burned.hero.alive);
});
