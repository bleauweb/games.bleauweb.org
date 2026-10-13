// Sequence Lab: number and shape sequences with one or more rules, and the words to explain them.

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon'];
export const COLORS = ['#e05a5a', '#e8a33d', '#e6d84a', '#4cc25e', '#4f8fff', '#b26ee6'];
export const COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export const SIZES = ['small', 'medium', 'large'];
export const ROTATIONS = [0, 90, 180, 270];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// ---------- number rules ----------
const NUMBER_RULES = {
  add: (rng) => {
    const d = int(rng, 2, 9);
    const start = int(rng, 1, 20);
    return { gen: (i) => start + d * i, explain: `Each number is ${d} more than the one before.` };
  },
  subtract: (rng) => {
    const d = int(rng, 2, 7);
    const start = int(rng, 40, 80);
    return { gen: (i) => start - d * i, explain: `Each number is ${d} less than the one before.` };
  },
  multiply: (rng) => {
    const m = pick(rng, [2, 3]);
    const start = int(rng, 1, 4);
    return { gen: (i) => start * m ** i, explain: `Each number is the one before times ${m}.` };
  },
  alternate: (rng) => {
    const a = int(rng, 2, 6);
    const b = int(rng, 1, 4);
    const start = int(rng, 1, 15);
    return { gen: (i) => start + Math.ceil(i / 2) * a - Math.floor(i / 2) * b, explain: `Add ${a}, then take away ${b}, and repeat.` };
  },
  growing: (rng) => {
    const start = int(rng, 1, 10);
    const first = int(rng, 1, 3);
    return { gen: (i) => start + (i * (2 * first + i - 1)) / 2, explain: `The gap grows by one each time: +${first}, +${first + 1}, +${first + 2}…` };
  },
  squares: () => ({ gen: (i) => (i + 1) ** 2, explain: 'The square numbers: 1×1, 2×2, 3×3…' }),
  triangular: () => ({ gen: (i) => ((i + 1) * (i + 2)) / 2, explain: 'The triangle numbers: each adds one more than the last (1, 3, 6, 10…).' }),
  fib: (rng) => {
    const a = int(rng, 1, 3);
    const b = int(rng, a, 5);
    const seq = [a, b];
    for (let i = 2; i < 12; i++) seq.push(seq[i - 1] + seq[i - 2]);
    return { gen: (i) => seq[i], explain: 'Each number is the sum of the two before it.' };
  },
  twoStep: (rng) => {
    const d1 = int(rng, 2, 5);
    const d2 = int(rng, 6, 12);
    const start = int(rng, 1, 10);
    return { gen: (i) => start + Math.ceil(i / 2) * d1 + Math.floor(i / 2) * d2, explain: `Two gaps take turns: +${d1}, then +${d2}.` };
  },
};

// ---------- shape rules ----------
// A shape item has { shape, color, size, rotation }. Each rule cycles one attribute.
function cycle(list, offset, period) {
  return (i) => list[(offset + Math.floor(i / period)) % list.length];
}
function attrRule(rng, attr, { period = 1 } = {}) {
  const list = attr === 'shape' ? SHAPES : attr === 'color' ? COLORS : attr === 'size' ? SIZES : ROTATIONS;
  const stepChoices = attr === 'rotation' ? [1, 2, 3] : [1, 2];
  const step = pick(rng, stepChoices);
  const offset = int(rng, 0, list.length - 1);
  const gen = (i) => list[(offset + step * Math.floor(i / period)) % list.length];
  const names = attr === 'color' ? COLOR_NAMES : list.map(String);
  const first3 = [0, 1, 2].map((k) => names[(offset + step * k) % names.length]).join(', ');
  const words = attr === 'rotation'
    ? `turns ${step * 90}° each time`
    : step === 1 ? `goes in order: ${first3}, and so on`
      : `skips one each time: ${first3}, and so on`;
  return { attr, gen, words: period > 1 ? `${words}, changing every ${period} items` : words };
}

export const LEVELS = [
  { id: 'add', name: 'Steady steps', tip: 'Numbers that go up or down by the same amount.', kind: 'number', rules: ['add', 'subtract'], terms: 5 },
  { id: 'shape1', name: 'One thing changes', tip: 'Shapes where a single feature follows a cycle.', kind: 'shape', attrs: 1, terms: 5 },
  { id: 'mult', name: 'Bigger jumps', tip: 'Doubling, tripling, and turn-taking gaps.', kind: 'number', rules: ['multiply', 'alternate', 'twoStep'], terms: 5 },
  { id: 'shape2', name: 'Two things change', tip: 'Two features cycle at once, each at its own pace.', kind: 'shape', attrs: 2, terms: 6 },
  { id: 'famous', name: 'Famous sequences', tip: 'Squares, triangles, growing gaps, and sums of neighbours.', kind: 'number', rules: ['squares', 'triangular', 'growing', 'fib'], terms: 5 },
  { id: 'shape3', name: 'Three things change', tip: 'Shape, colour and turn, all moving.', kind: 'shape', attrs: 3, terms: 6 },
  { id: 'mixed', name: 'Everything', tip: 'Any rule from any level.', kind: 'mixed', terms: 6 },
];

export function makeNumberPuzzle(rng, ruleNames, terms) {
  const name = pick(rng, ruleNames);
  const r = NUMBER_RULES[name](rng);
  const shown = Array.from({ length: terms }, (_, i) => r.gen(i));
  const answer = r.gen(terms);
  const wrong = new Set();
  const candidates = [answer + 1, answer - 1, answer + 2, answer - 2, r.gen(terms + 1), shown[terms - 1] + (shown[terms - 1] - shown[terms - 2]) * 2, answer + 3, answer - 3, answer * 2];
  for (let k = 4; k < 30; k++) candidates.push(answer + k, answer - k);
  for (const c of candidates) if (c !== answer && !wrong.has(c) && Number.isInteger(c) && wrong.size < 3) wrong.add(c);
  const options = shuffle(rng, [answer, ...wrong].map((v) => ({ value: v, label: String(v) })));
  return { kind: 'number', rule: name, shown, answer, options, explain: r.explain };
}

export function makeShapePuzzle(rng, attrCount, terms) {
  const attrs = shuffle(rng, ['shape', 'color', 'size', 'rotation']).slice(0, attrCount);
  const rules = attrs.map((a, i) => attrRule(rng, a, { period: i === 1 && attrCount >= 2 && rng() < 0.4 ? 2 : 1 }));
  const fixed = { shape: pick(rng, SHAPES), color: pick(rng, COLORS), size: 'medium', rotation: 0 };
  if (fixed.shape === 'circle' && attrs.includes('rotation')) fixed.shape = 'triangle';
  const item = (i) => {
    const it = { ...fixed };
    for (const r of rules) it[r.attr] = r.gen(i);
    if (it.shape === 'circle' && attrs.includes('rotation')) it.shape = 'triangle';
    return it;
  };
  const shown = Array.from({ length: terms }, (_, i) => item(i));
  const answer = item(terms);
  const key = (it) => `${it.shape}|${it.color}|${it.size}|${it.rotation}`;
  const wrong = [];
  const seen = new Set([key(answer)]);
  let guard = 0;
  while (wrong.length < 3 && guard++ < 200) {
    const w = { ...answer };
    // Vary a cycling attribute first; when those run out (size has only three values), vary any.
    const pool = guard < 40 ? attrs : ['shape', 'color', 'size', 'rotation'];
    const a = pick(rng, pool);
    const list = a === 'shape' ? SHAPES : a === 'color' ? COLORS : a === 'size' ? SIZES : ROTATIONS;
    w[a] = pick(rng, list.filter((v) => v !== answer[a]));
    if (w.shape === 'circle' && attrs.includes('rotation')) continue;
    if (!seen.has(key(w))) {
      seen.add(key(w));
      wrong.push(w);
    }
  }
  const options = shuffle(rng, [answer, ...wrong].map((v) => ({ value: key(v), item: v })));
  return { kind: 'shape', shown, answer: key(answer), options, explain: rules.map((r) => `The ${r.attr} ${r.words}.`).join(' ') };
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  if (level.kind === 'number') return makeNumberPuzzle(rng, level.rules, level.terms);
  if (level.kind === 'shape') return makeShapePuzzle(rng, level.attrs, level.terms);
  return rng() < 0.5 ? makeNumberPuzzle(rng, Object.keys(NUMBER_RULES), level.terms) : makeShapePuzzle(rng, int(rng, 1, 3), level.terms);
}

export function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ROUNDS = 8;
export const PASS = 6;
