// Permanent upgrades bought with coins between levels. Levels are tuned for an un-upgraded
// squad, so every one of these is a real edge.
export const UPGRADES = {
  start: {
    name: 'Recruits',
    desc: '+4 troops at the start of every level',
    max: 12,
    effect: (l) => 4 * l,
    cost: (l) => Math.round(15 * 1.45 ** l),
    show: (l) => `+${4 * l}`,
  },
  power: {
    name: 'Firepower',
    desc: '+12% damage from your troops',
    max: 10,
    effect: (l) => 1 + 0.12 * l,
    cost: (l) => Math.round(20 * 1.5 ** l),
    show: (l) => `${Math.round(100 + 12 * l)}%`,
  },
  armor: {
    name: 'Armor',
    desc: '−8% damage taken from enemies and bosses',
    max: 8,
    effect: (l) => Math.max(0.3, 1 - 0.08 * l),
    cost: (l) => Math.round(20 * 1.5 ** l),
    show: (l) => `${Math.round(100 - 8 * l)}%`,
  },
};

export function statsFor(levels) {
  return {
    startBonus: UPGRADES.start.effect(levels.start || 0),
    power: UPGRADES.power.effect(levels.power || 0),
    armor: UPGRADES.armor.effect(levels.armor || 0),
  };
}
