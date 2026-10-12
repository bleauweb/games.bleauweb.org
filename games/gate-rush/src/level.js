// Level generator. Every level is built from its number, so level 12 is the same for everyone.
//
// Winnability is designed in, not hoped for. While laying out the lane we track two squads:
//  - "best": always takes the better gate
//  - "ok":   takes the better gate about 70% of the time
// Enemy groups are sized so the ok squad survives them, and the boss is tuned by bisection so
// the ok squad still finishes with roughly a fifth of its troops. Play well and you win big.

import { mulberry32 } from './rng.js';
import { applyGate, simulateEncounter, simulateBoss } from './combat.js';

export const ROW_SPACING = 17;
export const FIRST_ROW_Z = -30;
export const PLAYER_START_Z = 8;
export const OK_PLAYER_SKILL = 0.72;
export const OK_PLAYER_MARGIN = 0.22;

export function baseStart(n) {
  return 10 + Math.floor((n - 1) * 1.5);
}

function difficulty(n) {
  return Math.min(1, (n - 1) / 40);
}

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function makeGatePair(rng, n, cBest, cOk) {
  const d = difficulty(n);
  const roll = rng();
  let a;
  let b;
  const okSafe = Math.max(1, Math.floor(cOk * 0.5)); // never take more than half of the ok squad

  if (roll < 0.35) {
    // Multiply or add: which is better depends on how big you are right now.
    const mult = rng() < 0.12 + d * 0.12 ? 3 : 2;
    const k = Math.max(3, Math.round(cBest * (mult - 1) * (0.6 + rng() * 0.8)));
    a = { op: '×', value: mult };
    b = { op: '+', value: k };
  } else if (roll < 0.58) {
    // Add vs add: read the numbers.
    const x = Math.max(2, Math.round(cBest * (0.2 + rng() * 0.5)));
    let y = Math.max(2, Math.round(cBest * (0.2 + rng() * 0.5)));
    if (y === x) y += 2;
    a = { op: '+', value: x };
    b = { op: '+', value: y };
  } else if (roll < 0.58 + 0.14 + d * 0.22) {
    // Lesser evil: both hurt, one hurts less.
    const x = clampInt(cBest * (0.12 + rng() * 0.28), 1, okSafe);
    if (rng() < 0.5) {
      a = { op: '−', value: x };
      b = { op: '÷', value: 2 };
    } else {
      let y = clampInt(cBest * (0.12 + rng() * 0.28), 1, okSafe);
      if (y === x) y = Math.max(1, y - 1);
      a = { op: '−', value: x };
      b = { op: '−', value: y };
    }
  } else {
    // Good vs bad: the easy ones, mostly early on.
    const x = Math.max(2, Math.round(cBest * (0.2 + rng() * 0.6)));
    const y = clampInt(cBest * (0.1 + rng() * 0.4), 1, okSafe);
    a = { op: '+', value: x };
    b = rng() < 0.3 ? { op: '÷', value: 2 } : { op: '−', value: y };
  }
  return rng() < 0.5 ? [a, b] : [b, a];
}

function betterOf(count, left, right) {
  return applyGate(count, left) >= applyGate(count, right) ? left : right;
}

function worseOf(count, left, right) {
  return applyGate(count, left) >= applyGate(count, right) ? right : left;
}

export function generateLevel(n) {
  const rng = mulberry32(n * 7919 + 13);
  const okRng = mulberry32(n * 31 + 7);
  const d = difficulty(n);
  const start = baseStart(n);

  const rowCount = Math.min(15, 7 + Math.floor(n / 3));
  const types = ['gates'];
  let enemies = 0;
  for (let i = 1; i < rowCount; i++) {
    const prev = types[i - 1];
    let t;
    if (prev === 'enemy') t = 'gates';
    else {
      const r = rng();
      if (r < 0.34) t = 'enemy';
      else if (r < 0.52) t = 'coins';
      else t = 'gates';
    }
    if (t === 'enemy') enemies++;
    types.push(t);
  }
  // At least two fights per level; swap in from the back so the opener stays a gate.
  for (let i = rowCount - 2; enemies < 2 && i > 1; i--) {
    if (types[i] === 'coins' || (types[i] === 'gates' && types[i - 1] !== 'enemy' && types[i + 1] !== 'enemy')) {
      types[i] = 'enemy';
      enemies++;
    }
  }

  let best = start;
  let ok = start;
  const rows = [];
  let z = FIRST_ROW_Z;

  for (const type of types) {
    if (type === 'gates') {
      const [left, right] = makeGatePair(rng, n, Math.ceil(best), Math.ceil(ok));
      const cb = Math.ceil(best);
      const co = Math.ceil(ok);
      best = applyGate(cb, betterOf(cb, left, right));
      ok = applyGate(co, okRng() < OK_PLAYER_SKILL ? betterOf(co, left, right) : worseOf(co, left, right));
      ok = Math.max(ok, 1);
      rows.push({ type, z, left, right });
    } else if (type === 'enemy') {
      const frac = 0.3 + d * 0.3 + rng() * 0.2;
      let count = Math.max(3, Math.round(best * frac));
      count = Math.min(count, Math.max(3, Math.floor(Math.ceil(ok) * 0.75)));
      const where = rng();
      const x = where < 0.4 ? 0 : where < 0.7 ? -1.7 : 1.7;
      const halfWidth = x === 0 ? 3.6 : 1.5;
      best = simulateEncounter(best, count).count;
      ok = simulateEncounter(ok, count).count;
      rows.push({ type, z, x, halfWidth, count });
    } else {
      const side = rng() < 0.5 ? -1.6 : 1.6;
      const amount = 4 + Math.floor(rng() * 3);
      const positions = [];
      for (let i = 0; i < amount; i++) positions.push({ x: side, z: z + (i - (amount - 1) / 2) * 1.5 });
      rows.push({ type, z, positions });
    }
    z -= ROW_SPACING;
  }

  const cOk = Math.ceil(ok);
  const cBest = Math.ceil(best);
  const bossDps = Math.max(1.5, 0.08 * cOk * (0.9 + d * 0.5));
  let lo = 1;
  let hi = 200000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const r = simulateBoss(cOk, mid, bossDps);
    if (r.won && r.count >= OK_PLAYER_MARGIN * cOk) lo = mid;
    else hi = mid;
  }
  const hp = Math.max(10, Math.floor(lo)); // floor keeps the bisection's promise
  const boss = { z: z - 4, hp, dps: bossDps };

  return {
    n,
    start,
    rows,
    boss,
    endZ: boss.z - 30,
    expected: { best: cBest, ok: cOk },
  };
}
