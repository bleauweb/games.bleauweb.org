import { LEVELS } from '../../games/odd-one-out/src/odd.js';
import { emit, pack } from './emit.mjs';
import { wrap, cStrings, Strings } from './text.mjs';
import { SHAPES, FILLS, SIZES, COUNTS, code, pick, mulberry32 } from './gbitems.mjs';
const ATTRS = { shape: SHAPES, fill: FILLS, size: SIZES, count: COUNTS };
const gbAttr = (a) => (a === 'color' ? 'fill' : a);
const randomItem = (rng) => ({ shape: pick(rng, SHAPES), fill: pick(rng, FILLS), size: pick(rng, SIZES), count: pick(rng, COUNTS) });
function makePuzzle(level, rng) {
  const lvAttrs = [...new Set(level.attrs.map(gbAttr))];
  for (let attempt = 0; attempt < 500; attempt++) {
    const attrs = [pick(rng, lvAttrs)];
    if (level.pair) attrs.push(pick(rng, lvAttrs.filter((a) => a !== attrs[0])));
    const base = randomItem(rng);
    const items = [];
    for (let i = 0; i < level.items; i++) { const it = level.noise ? randomItem(rng) : { ...base }; for (const a of attrs) it[a] = base[a]; items.push(it); }
    const odd = Math.floor(rng() * items.length);
    const breakAttr = pick(rng, attrs);
    items[odd][breakAttr] = pick(rng, ATTRS[breakAttr].filter((v) => v !== base[breakAttr]));
    const ambiguous = Object.keys(ATTRS).some((a) => {
      if (attrs.includes(a)) return false;
      const counts = {}; for (const it of items) counts[it[a]] = (counts[it[a]] || 0) + 1;
      const v = Object.values(counts); return v.length === 2 && v.includes(1);
    });
    if (ambiguous) continue;
    const word = (a, v) => (a === 'count' ? `${v} of them` : `${v} ${a === 'fill' ? 'fill' : a}`);
    const shared = attrs.map((a) => word(a, base[a])).join(' and ');
    return { items, odd, explain: `The others share ${shared}. This one has ${word(breakAttr, items[odd][breakAttr])}.`, hint: `Compare ${attrs.join(' and ')}.` };
  }
  throw new Error('no puzzle');
}
const PER = 16, STRIDE = 1 + 6 + 1 + 1 + 1;
const strings = new Strings(); const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  const rng = mulberry32(23000 + li);
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, rng);
    const bytes = [p.items.length];
    for (let k = 0; k < 6; k++) bytes.push(k < p.items.length ? code(p.items[k]) : 0);
    bytes.push(p.odd, strings.add(wrap(p.explain)), strings.add(wrap(p.hint, 20, 1)));
    puzzles.push(bytes); json.push({ level: li, ...p });
  }
});
emit('odd-one-out', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, extra: cStrings('EXPL', strings.list), json });
