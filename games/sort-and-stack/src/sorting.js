// Sort and Stack: put items in bins by a stated rule, then by a rule you have to work out.

export const SHAPES = ['circle', 'square', 'triangle', 'star'];
export const COLORS = { red: '#e05a5a', blue: '#4f8fff', green: '#4cc25e', yellow: '#e6d84a' };
export const SIZES = ['small', 'large'];
export const FILLS = ['solid', 'hollow'];
const ATTRS = { shape: SHAPES, color: Object.keys(COLORS), size: SIZES, fill: FILLS };

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
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const LEVELS = [
  { id: 'color', name: 'By colour', tip: 'The bins say which colour goes where.', rule: 'single', attr: 'color', labelled: true, items: 12 },
  { id: 'shape', name: 'By shape', tip: 'Four bins, one for each shape.', rule: 'single', attr: 'shape', labelled: true, items: 12 },
  { id: 'two', name: 'Two things at once', tip: 'Colour and size together decide the bin.', rule: 'pair', attrs: ['color', 'size'], labelled: true, items: 12 },
  { id: 'find1', name: 'Find the rule', tip: 'No labels. Two examples sit in each bin. Work out what they share.', rule: 'single', labelled: false, items: 12 },
  { id: 'yesno', name: 'Is it, or isn’t it?', tip: 'Two bins: things that fit a rule, and things that do not.', rule: 'boolean', labelled: false, items: 12 },
  { id: 'find2', name: 'Find the rule, two features', tip: 'The bins combine two features. Examples only.', rule: 'pair', labelled: false, items: 14 },
  { id: 'mixed', name: 'Any rule', tip: 'Stated or hidden, one feature or two.', rule: 'mixed', items: 14 },
];

function ruleFor(level, rng) {
  let kind = level.rule;
  if (kind === 'mixed') kind = pick(rng, ['single', 'pair', 'boolean']);
  if (kind === 'single') {
    const attr = level.attr || pick(rng, Object.keys(ATTRS));
    const values = attr === 'shape' || attr === 'color' ? shuffle(rng, ATTRS[attr]).slice(0, 3 + Math.floor(rng() * 2)) : ATTRS[attr];
    return {
      kind, attr, values,
      bins: values.map((v) => ({ label: v })),
      binOf: (it) => values.indexOf(it[attr]),
      fits: (it) => values.includes(it[attr]),
      explain: `Sorted by ${attr}: ${values.join(', ')}.`,
    };
  }
  if (kind === 'pair') {
    const attrs = level.attrs || shuffle(rng, Object.keys(ATTRS)).slice(0, 2);
    const [a, b] = attrs;
    const va = ATTRS[a].slice(0, 2);
    const vb = ATTRS[b].slice(0, 2);
    const combos = [];
    for (const x of va) for (const y of vb) combos.push([x, y]);
    return {
      kind, attrs, va, vb,
      bins: combos.map(([x, y]) => ({ label: `${x} ${y}` })),
      binOf: (it) => combos.findIndex(([x, y]) => it[a] === x && it[b] === y),
      fits: (it) => va.includes(it[a]) && vb.includes(it[b]),
      explain: `Sorted by ${a} and ${b} together: ${combos.map(([x, y]) => `${x} ${y}`).join(', ')}.`,
    };
  }
  const attr = pick(rng, Object.keys(ATTRS));
  const value = pick(rng, ATTRS[attr]);
  return {
    kind: 'boolean', attr, value,
    bins: [{ label: value }, { label: `not ${value}` }],
    binOf: (it) => (it[attr] === value ? 0 : 1),
    fits: () => true,
    explain: `One bin is everything ${value}; the other is everything that is not ${value}.`,
  };
}

function randomItem(rng) {
  return { shape: pick(rng, SHAPES), color: pick(rng, Object.keys(COLORS)), size: pick(rng, SIZES), fill: pick(rng, FILLS) };
}

export function makePuzzle(level, seed) {
  const rng = mulberry32(seed);
  const rule = ruleFor(level, rng);
  const labelled = level.labelled !== undefined ? level.labelled : rng() < 0.5;
  const items = [];
  const perBin = new Array(rule.bins.length).fill(0);
  let guard = 0;
  // Each bin gets at least two items (one may be shown as an example) before random fill.
  while ((items.length < level.items || perBin.some((n) => n < 2)) && guard++ < 5000) {
    const it = randomItem(rng);
    if (!rule.fits(it)) continue;
    const b = rule.binOf(it);
    if (b < 0) continue;
    if (items.length >= level.items && perBin[b] >= 2) continue;
    if (items.length < level.items || perBin[b] < 2) {
      it.id = items.length;
      it.bin = b;
      items.push(it);
      perBin[b]++;
    }
  }
  // Hidden-rule levels show one example per bin already placed.
  const examples = [];
  if (!labelled) {
    for (let b = 0; b < rule.bins.length; b++) {
      const ex = items.find((it) => it.bin === b);
      examples.push(ex.id);
    }
  }
  return {
    bins: rule.bins.map((bn) => ({ label: labelled ? bn.label : '?' })),
    items: shuffle(rng, items),
    examples,
    labelled,
    explain: rule.explain,
    attrHint: rule.kind === 'pair' ? `Look at ${rule.attrs[0]} and ${rule.attrs[1]}.` : `Look at the ${rule.attr}.`,
  };
}
