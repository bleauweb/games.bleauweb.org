// Permanent upgrades bought with coins between levels. Levels are tuned for an un-upgraded
// squad, so every one of these is a real edge. Extra troops come from the Base (merge grid).
export const UPGRADES = {
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
  hero: {
    name: 'Hero',
    desc: '+2 hero levels at the start of every level',
    max: 10,
    effect: (l) => 1 + 2 * l,
    cost: (l) => Math.round(25 * 1.5 ** l),
    show: (l) => `Lv ${1 + 2 * l}`,
  },
};

export function statsFor(levels, armyBonus = 0) {
  return {
    startBonus: armyBonus,
    power: UPGRADES.power.effect(levels.power || 0),
    armor: UPGRADES.armor.effect(levels.armor || 0),
    heroStart: UPGRADES.hero.effect(levels.hero || 0),
  };
}
