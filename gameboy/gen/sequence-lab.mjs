import { LEVELS, makeNumberPuzzle } from '../../games/sequence-lab/src/sequences.js';
import { emit, pack, u16 } from './emit.mjs';
import { wrap, cStrings, Strings } from './text.mjs';
import { SHAPES, FILLS, SIZES, code, pick, shuffle, mulberry32 } from './gbitems.mjs';
const PER = 16, STRIDE = 1 + 1 + 12 + 8 + 1 + 1;
const NUMBER_RULES = ['add', 'subtract', 'multiply', 'alternate', 'twoStep', 'squares', 'triangular', 'growing', 'fib'];
const GB_SHAPES = SHAPES.slice(0, 4);
function shapePuzzle(rng, attrCount, terms) {
  const attrs = shuffle(rng, ['shape', 'fill', 'size']).slice(0, attrCount);
  const lists = { shape: GB_SHAPES, fill: FILLS, size: SIZES };
  const rules = attrs.map((a, i) => {
    let values = shuffle(rng, lists[a]);
    if (a === 'shape') values = values.slice(0, 3 + Math.floor(rng() * 2));
    const period = i === 1 && rng() < 0.4 ? 2 : 1;
    return { attr: a, values, period, gen: (k) => values[Math.floor(k / period) % values.length] };
  });
  const fixed = { shape: pick(rng, GB_SHAPES), fill: pick(rng, FILLS), size: 'large' };
  const item = (k) => { const it = { ...fixed }; for (const r of rules) it[r.attr] = r.gen(k); return it; };
  const shown = Array.from({ length: terms }, (_, k) => item(k));
  const answer = item(terms);
  const key = (it) => `${it.shape}|${it.fill}|${it.size}`;
  const seen = new Set([key(answer)]); const wrong = [];
  let guard = 0;
  while (wrong.length < 3 && guard++ < 200) {
    const w = { ...answer };
    const a = pick(rng, guard < 40 ? attrs : ['shape', 'fill', 'size']);
    w[a] = pick(rng, lists[a].filter((v) => v !== answer[a]));
    if (!seen.has(key(w))) { seen.add(key(w)); wrong.push(w); }
  }
  const options = shuffle(rng, [answer, ...wrong]);
  const explain = rules.map((r) => `${r.attr} goes ${r.values.join(', ')}${r.period === 2 ? ' (two at a time)' : ''}.`).join(' ');
  return { kind: 'shape', shown, options, answerIndex: options.findIndex((o) => key(o) === key(answer)), explain };
}
const strings = new Strings(); const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  const rng = mulberry32(21000 + li);
  for (let i = 0; i < PER; i++) {
    let kind = level.kind; if (kind === 'mixed') kind = rng() < 0.5 ? 'number' : 'shape';
    let p;
    if (kind === 'number') {
      const q = makeNumberPuzzle(rng, level.rules || NUMBER_RULES, level.terms);
      if (q.shown.some((v) => v < 0 || v > 9999) || q.options.some((o) => o.value < 0 || o.value > 9999)) { i--; continue; }
      p = { kind: 'number', shown: q.shown, options: q.options.map((o) => o.value), answerIndex: q.options.findIndex((o) => o.value === q.answer), explain: q.explain };
    } else p = shapePuzzle(rng, level.attrs || 1 + Math.floor(rng() * 3), level.terms);
    const bytes = [p.kind === 'number' ? 0 : 1, p.shown.length];
    for (let k = 0; k < 6; k++) bytes.push(...u16(k < p.shown.length ? (p.kind === 'number' ? p.shown[k] : code(p.shown[k])) : 0));
    for (let k = 0; k < 4; k++) bytes.push(...u16(p.kind === 'number' ? p.options[k] : code(p.options[k])));
    bytes.push(p.answerIndex, strings.add(wrap(p.explain.replace(/×/g, 'x').replace(/…/g, '...'))));
    puzzles.push(bytes); json.push({ level: li, ...p });
  }
});
emit('sequence-lab', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, extra: cStrings('EXPL', strings.list), json });
