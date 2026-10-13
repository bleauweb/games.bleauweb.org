import { LEVELS } from '../../games/sort-and-stack/src/sorting.js';
import { emit, pack } from './emit.mjs';
import { wrap, cStrings, Strings } from './text.mjs';
import { SHAPES, FILLS, SIZES, code, pick, shuffle, mulberry32 } from './gbitems.mjs';
const GB_SHAPES = SHAPES.slice(0, 4);
const ATTRS = { shape: GB_SHAPES, fill: FILLS, size: SIZES };
const gbAttr = (a) => (a === 'color' ? 'fill' : a);
const randomItem = (rng) => ({ shape: pick(rng, GB_SHAPES), fill: pick(rng, FILLS), size: pick(rng, SIZES) });
// a bin label is up to two icons: an item code showing just the named attribute(s), plus a "not" flag
const icon = (parts) => code({ shape: parts.shape || 'square', fill: parts.fill || 'solid', size: parts.size || 'large' });
function ruleFor(level, rng) {
  let kind = level.rule; if (kind === 'mixed') kind = pick(rng, ['single', 'pair', 'boolean']);
  if (kind === 'single') {
    const attr = level.attr ? gbAttr(level.attr) : pick(rng, Object.keys(ATTRS));
    const values = attr === 'shape' ? shuffle(rng, ATTRS[attr]).slice(0, 3 + Math.floor(rng() * 2)) : ATTRS[attr];
    return { kind, attr, bins: values.map((v) => ({ icons: [icon({ [attr]: v })], not: 0, text: v })), binOf: (it) => values.indexOf(it[attr]), fits: (it) => values.includes(it[attr]), explain: `Sorted by ${attr}: ${values.join(', ')}.`, hint: `Look at the ${attr}.` };
  }
  if (kind === 'pair') {
    const attrs = level.attrs ? level.attrs.map(gbAttr) : shuffle(rng, Object.keys(ATTRS)).slice(0, 2);
    const [a, b] = attrs; const va = ATTRS[a].slice(0, 2), vb = ATTRS[b].slice(0, 2);
    const combos = []; for (const x of va) for (const y of vb) combos.push([x, y]);
    return { kind, attrs, bins: combos.map(([x, y]) => ({ icons: [icon({ [a]: x }), icon({ [b]: y })], not: 0, text: `${x} ${y}` })), binOf: (it) => combos.findIndex(([x, y]) => it[a] === x && it[b] === y), fits: (it) => va.includes(it[a]) && vb.includes(it[b]), explain: `Sorted by ${a} and ${b} together: ${combos.map(([x, y]) => `${x} ${y}`).join(', ')}.`, hint: `Look at ${a} and ${b}.` };
  }
  const attr = pick(rng, Object.keys(ATTRS)); const value = pick(rng, ATTRS[attr]);
  return { kind: 'boolean', attr, bins: [{ icons: [icon({ [attr]: value })], not: 0, text: value }, { icons: [icon({ [attr]: value })], not: 1, text: `not ${value}` }], binOf: (it) => (it[attr] === value ? 0 : 1), fits: () => true, explain: `One bin is everything ${value}; the other is everything that is not ${value}.`, hint: `Look at the ${attr}.` };
}
function makePuzzle(level, rng) {
  const rule = ruleFor(level, rng);
  const labelled = level.labelled !== undefined ? level.labelled : rng() < 0.5;
  const items = []; const perBin = new Array(rule.bins.length).fill(0); let guard = 0;
  while ((items.length < level.items || perBin.some((n) => n < 2)) && guard++ < 5000) {
    const it = randomItem(rng); if (!rule.fits(it)) continue;
    const b = rule.binOf(it); if (b < 0) continue;
    if (items.length >= level.items && perBin[b] >= 2) continue;
    it.bin = b; items.push(it); perBin[b]++;
  }
  const shuffled = shuffle(rng, items).slice(0, 14);
  const examples = [];
  if (!labelled) for (let b = 0; b < rule.bins.length; b++) { const ex = shuffled.findIndex((it) => it.bin === b); if (ex >= 0) examples.push(ex); }
  return { items: shuffled, bins: rule.bins, labelled, examples, explain: rule.explain, hint: rule.hint };
}
const PER = 6, STRIDE = 1 + 14 + 14 + 1 + 1 + 4 + 4 * 3 + 1 + 1;
const strings = new Strings(); const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  const rng = mulberry32(25000 + li);
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, rng);
    const bytes = [p.items.length];
    for (let k = 0; k < 14; k++) bytes.push(k < p.items.length ? code(p.items[k]) : 0);
    for (let k = 0; k < 14; k++) bytes.push(k < p.items.length ? p.items[k].bin : 0);
    bytes.push(p.bins.length, p.labelled ? 1 : 0);
    for (let k = 0; k < 4; k++) bytes.push(k < p.examples.length ? p.examples[k] : 255);
    for (let k = 0; k < 4; k++) { const b = p.bins[k]; bytes.push(b ? b.icons[0] : 255, b && b.icons[1] !== undefined ? b.icons[1] : 255, b ? b.not : 0); }
    bytes.push(strings.add(wrap(p.explain)), strings.add(wrap(p.hint, 20, 1)));
    puzzles.push(bytes); json.push({ level: li, ...p });
  }
});
emit('sort-and-stack', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, extra: cStrings('EXPL', strings.list), json });
