import { LEVELS, makePuzzle } from '../../games/binary-grid/src/binary.js';
import { emit, pack, rowMask } from './emit.mjs';
const PER = 8, STRIDE = 1 + 4 * 10;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, 5000 + li * 100 + i);
    const bytes = [p.n];
    for (let y = 0; y < p.n; y++) bytes.push(...rowMask(p.givens[y], (v) => v !== -1), ...rowMask(p.solution[y], (v) => v === 1));
    puzzles.push(bytes); json.push({ level: li, n: p.n, givens: p.givens, solution: p.solution });
  }
});
emit('binary-grid', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
