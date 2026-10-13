// Odd One Out: several items share a rule, one breaks it. Find it; the rule is explained.
import { mulberry32 } from '../../sequence-lab/src/sequences.js';

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'hexagon'];
export const COLORS = { red: '#e05a5a', blue: '#4f8fff', green: '#4cc25e', yellow: '#e6d84a', purple: '#b26ee6' };
export const SIZES = ['small', 'large'];
export const FILLS = ['solid', 'hollow'];
export const COUNTS = [1, 2, 3];
const ATTRS = { shape: SHAPES, color: Object.keys(COLORS), size: SIZES, fill: FILLS, count: COUNTS };

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export const LEVELS = [
  { id: 'one', name: 'One feature', tip: 'Four items. Three share a colour or shape; one does not.', items: 4, attrs: ['color', 'shape'], noise: 0 },
  { id: 'any', name: 'Any feature', tip: 'The shared thing could be size, fill or how many.', items: 4, attrs: ['color', 'shape', 'size', 'fill', 'count'], noise: 0 },
  { id: 'noisy', name: 'Distractions', tip: 'The other features vary too. Find what three really share.', items: 5, attrs: ['color', 'shape', 'size', 'fill', 'count'], noise: 1 },
  { id: 'two', name: 'Two features', tip: 'The rule combines two features, like red and large.', items: 5, attrs: ['color', 'shape', 'size', 'fill', 'count'], pair: true, noise: 1 },
  { id: 'six', name: 'Six items', tip: 'More to compare.', items: 6, attrs: ['color', 'shape', 'size', 'fill', 'count'], noise: 1 },
];

function randomItem(rng) {
  return { shape: pick(rng, SHAPES), color: pick(rng, Object.keys(COLORS)), size: pick(rng, SIZES), fill: pick(rng, FILLS), count: pick(rng, COUNTS) };
}

/**
 * Build items so that exactly one breaks the rule. With noise, other attributes are free;
 * without noise, the non-rule attributes are shared too so the odd one is the only difference.
 */
export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const attrs = [pick(rng, level.attrs)];
    if (level.pair) {
      const other = level.attrs.filter((a) => a !== attrs[0]);
      attrs.push(pick(rng, other));
    }
    const base = randomItem(rng);
    const items = [];
    for (let i = 0; i < level.items; i++) {
      const it = level.noise ? randomItem(rng) : { ...base };
      for (const a of attrs) it[a] = base[a];
      items.push(it);
    }
    // The odd one breaks exactly one rule attribute (so a pair rule still shows the other).
    const oddIndex = Math.floor(rng() * items.length);
    const breakAttr = pick(rng, attrs);
    const odd = items[oddIndex];
    odd[breakAttr] = pick(rng, ATTRS[breakAttr].filter((v) => v !== base[breakAttr]));
    // Make sure no other attribute is accidentally shared by all but one item (an alternative answer).
    const ambiguous = Object.keys(ATTRS).some((a) => {
      if (attrs.includes(a)) return false;
      const counts = {};
      for (const it of items) counts[it[a]] = (counts[it[a]] || 0) + 1;
      const values = Object.values(counts);
      return values.length === 2 && values.includes(1);
    });
    if (ambiguous) continue;
    const shared = attrs.map((a) => `${a}: ${base[a]}`).join(' and ');
    return {
      items: items.map((it, i) => ({ ...it, id: i })),
      odd: oddIndex,
      explain: `The others share ${shared}. This one has ${breakAttr}: ${odd[breakAttr]}.`,
      hint: `Compare ${attrs.join(' and ')}.`,
    };
  }
  throw new Error('no puzzle');
}

export const ROUNDS = 8;
export const PASS = 6;
