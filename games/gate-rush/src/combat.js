// The numbers that decide fights. The level generator and the live game both use these
// functions, so what the generator promises ("a reasonable player wins") is what happens.
//
// A squad is { count, tier, hero }:
//   count  troops (float while fighting, integer at gates)
//   tier   0 Rifles, 1 Heavies, 2 Tanks, 3 Mechs — every troop evolves at once (UPGRADE gates)
//   hero   the hero's level; the hero fights alongside the squad and never dies

export const RUN_SPEED = 9; // lane units per second
export const PLAYER_RANGE = 20; // our squad starts shooting at this distance
export const ENEMY_RANGE = 11; // enemies start shooting back here
export const ENEMY_WALK = 2.5; // hordes charge toward you once the shooting starts
export const BOSS_STAND_OFF = 11; // where the squad stops for the boss fight
export const BOSS_TELEGRAPH = 0.8; // seconds before the boss opens fire

export const TIERS = [
  { name: 'Rifles', mult: 1, tough: 1 },
  { name: 'Heavies', mult: 1.6, tough: 1.3 },
  { name: 'Tanks', mult: 2.6, tough: 1.7 },
  { name: 'Mechs', mult: 4.2, tough: 2.2 },
];
export const MAX_TIER = TIERS.length - 1;

export function heroPower(level) {
  return 10 * level;
}

/** How much the hero amplifies the whole army: Lv 1 = ×1, every level adds 8%. */
export function heroBoost(level) {
  return 1 + 0.08 * (level - 1);
}

/** Enemies killed per second by a squad. The hero rallies the troops rather than soloing. */
export function playerFire(squad, power = 1) {
  if (squad.count <= 0) return 0;
  const t = TIERS[Math.min(squad.tier, MAX_TIER)];
  return (0.35 * squad.count * t.mult + 2) * heroBoost(squad.hero) * power;
}

/** Our troops killed per second by `count` enemies, before armor and tier toughness. */
export function enemyFire(count) {
  return count > 0 ? 0.3 * count : 0;
}

export function toughness(squad) {
  return TIERS[Math.min(squad.tier, MAX_TIER)].tough;
}

/** A gate is { op, value }. Returns a new squad; never mutates. */
export function applyGate(squad, gate) {
  const s = { ...squad, count: Math.ceil(squad.count) };
  switch (gate.op) {
    case '+':
      s.count += gate.value;
      break;
    case '×':
      s.count *= gate.value;
      break;
    // A bad gate hurts, but it never takes your last soldier. Enemies can.
    case '−':
      s.count = Math.max(1, s.count - gate.value);
      break;
    case '÷':
      s.count = Math.max(1, Math.floor(s.count / gate.value));
      break;
    case 'tier':
      if (s.tier < MAX_TIER) s.tier += 1;
      else s.count = Math.floor(s.count * 1.5); // already Mechs: the gate still gives something
      break;
    case 'hero':
      s.hero += gate.value;
      break;
    default:
      break;
  }
  return s;
}

export function gateIsGood(gate) {
  return gate.op !== '−' && gate.op !== '÷';
}

export function gateKind(gate) {
  if (gate.op === 'tier') return 'tier';
  if (gate.op === 'hero') return 'hero';
  return gateIsGood(gate) ? 'good' : 'bad';
}

export function gateLabel(gate) {
  if (gate.op === 'tier') return 'UPGRADE';
  if (gate.op === 'hero') return `HERO +${gate.value}`;
  return `${gate.op}${gate.value}`;
}

/** What a gate would do, in one short string, for the preview under the gate. */
export function gatePreview(squad, gate) {
  const after = applyGate(squad, gate);
  if (gate.op === 'tier') return squad.tier < MAX_TIER ? `→ ${TIERS[after.tier].name}` : `= ${after.count}`;
  if (gate.op === 'hero') return `Lv ${after.hero}`;
  return `= ${after.count}`;
}

/**
 * The single number both gates of a pair are compared on. In a fight the squad's survival
 * scales with count × fire × toughness (more troops, hitting harder, dying slower), so that
 * product is what we rank by; the square root keeps the number readable.
 */
export function squadStrength(squad, power = 1) {
  if (squad.count <= 0) return 0;
  return Math.sqrt(squad.count * playerFire(squad, power) * toughness(squad));
}

/** Shown in the HUD and the VS banner. */
export function displayPower(squad, power = 1) {
  return Math.round(squadStrength(squad, power) * 10);
}

/**
 * Approach an enemy group that blocks the lane and fight until one side is gone.
 * Mirrors the live game: we fire from PLAYER_RANGE, they answer from ENEMY_RANGE,
 * the squad stops when it reaches them.
 */
export function simulateEncounter(squad, enemies, power = 1, armor = 1, dt = 1 / 30) {
  const s = { ...squad };
  let e = enemies;
  let dist = PLAYER_RANGE;
  let guard = 0;
  const tough = toughness(s);
  while (e > 0 && s.count > 0 && guard++ < 100000) {
    e -= playerFire(s, power) * dt;
    if (dist <= ENEMY_RANGE) s.count -= (enemyFire(e) * armor / tough) * dt;
    dist = Math.max(0, dist - (RUN_SPEED + ENEMY_WALK) * dt);
  }
  s.count = Math.max(0, s.count);
  return { squad: s, enemies: Math.max(0, e) };
}

/** Walk up to the boss shooting, stop at BOSS_STAND_OFF, trade fire until someone drops. */
export function simulateBoss(squad, hp, bossDps, power = 1, armor = 1, dt = 1 / 30) {
  const s = { ...squad };
  let h = hp;
  let dist = PLAYER_RANGE;
  let stood = 0;
  let guard = 0;
  const tough = toughness(s);
  while (h > 0 && s.count > 0 && guard++ < 100000) {
    h -= playerFire(s, power) * dt;
    if (dist <= BOSS_STAND_OFF) {
      if (stood >= BOSS_TELEGRAPH) s.count -= (bossDps * armor / tough) * dt;
      stood += dt;
    } else {
      dist -= RUN_SPEED * dt;
    }
  }
  s.count = Math.max(0, s.count);
  return { squad: s, hp: Math.max(0, h), won: h <= 0 };
}

/**
 * The boss's "power" for the VS banner: the display power of the smallest squad (at this
 * squad's tier and hero level, with these stats) that would still beat it. Higher than the
 * boss's number means you win.
 */
export function bossPowerFor(squad, boss, power = 1, armor = 1) {
  let lo = 0;
  let hi = Math.max(10, squad.count * 4 + 10);
  while (!simulateBoss({ ...squad, count: hi }, boss.hp, boss.dps, power, armor).won && hi < 1e6) hi *= 2;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (simulateBoss({ ...squad, count: mid }, boss.hp, boss.dps, power, armor).won) hi = mid;
    else lo = mid;
  }
  return displayPower({ ...squad, count: hi }, power);
}
