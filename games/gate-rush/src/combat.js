// The numbers that decide fights. The level generator and the live game both use these
// functions, so what the generator promises ("a reasonable player wins") is what happens.

export const RUN_SPEED = 9; // lane units per second
export const PLAYER_RANGE = 20; // our squad starts shooting at this distance
export const ENEMY_RANGE = 11; // enemies start shooting back here
export const BOSS_STAND_OFF = 11; // where the squad stops for the boss fight
export const BOSS_TELEGRAPH = 0.8; // seconds before the boss opens fire

/** Enemies killed per second by a squad of `count` troops. */
export function playerFire(count, power = 1) {
  return count > 0 ? (0.35 * count + 2) * power : 0;
}

/** Our troops killed per second by `count` enemies. */
export function enemyFire(count) {
  return count > 0 ? 0.3 * count : 0;
}

export function applyGate(count, gate) {
  switch (gate.op) {
    case '+':
      return count + gate.value;
    case '×':
      return count * gate.value;
    // A bad gate hurts, but it never takes your last soldier. Enemies can.
    case '−':
      return Math.max(1, count - gate.value);
    case '÷':
      return Math.max(1, Math.floor(count / gate.value));
    default:
      return count;
  }
}

export function gateIsGood(gate) {
  return gate.op === '+' || gate.op === '×';
}

export function gateLabel(gate) {
  return `${gate.op}${gate.value}`;
}

/**
 * Approach an enemy group that blocks the lane and fight until one side is gone.
 * Mirrors the live game: we fire from PLAYER_RANGE, they answer from ENEMY_RANGE,
 * the squad stops when it reaches them.
 */
export function simulateEncounter(count, enemies, power = 1, armor = 1, dt = 1 / 30) {
  let c = count;
  let e = enemies;
  let dist = PLAYER_RANGE;
  let guard = 0;
  while (e > 0 && c > 0 && guard++ < 100000) {
    e -= playerFire(c, power) * dt;
    if (dist <= ENEMY_RANGE) c -= enemyFire(e) * armor * dt;
    dist = Math.max(0, dist - RUN_SPEED * dt);
  }
  return { count: Math.max(0, c), enemies: Math.max(0, e) };
}

/** Walk up to the boss shooting, stop at BOSS_STAND_OFF, trade fire until someone drops. */
export function simulateBoss(count, hp, bossDps, power = 1, armor = 1, dt = 1 / 30) {
  let c = count;
  let h = hp;
  let dist = PLAYER_RANGE;
  let stood = 0;
  let guard = 0;
  while (h > 0 && c > 0 && guard++ < 100000) {
    h -= playerFire(c, power) * dt;
    if (dist <= BOSS_STAND_OFF) {
      if (stood >= BOSS_TELEGRAPH) c -= bossDps * armor * dt;
      stood += dt;
    } else {
      dist -= RUN_SPEED * dt;
    }
  }
  return { count: Math.max(0, c), hp: Math.max(0, h), won: h <= 0 };
}
