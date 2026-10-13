import { LEVELS, makePuzzle } from '../../games/circuit-paths/src/paths.js';
import { emit, pack } from './emit.mjs';
const PER = 8, STRIDE = 2 + 40;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, 17000 + li * 100 + i);
    const bytes = [p.n, p.pairs.length];
    for (const pr of p.pairs) bytes.push(pr.a[0], pr.a[1], pr.b[0], pr.b[1]);
    puzzles.push(bytes); json.push({ level: li, n: p.n, pairs: p.pairs.map((pr) => ({ a: pr.a, b: pr.b })), solution: p.solution });
  }
});
emit('circuit-paths', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
