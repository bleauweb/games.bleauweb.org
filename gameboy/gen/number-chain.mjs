import { LEVELS, makePuzzle } from '../../games/number-chain/src/chain.js';
import { emit, pack } from './emit.mjs';
const PER = 8, STRIDE = 1 + 98;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  let seed = 13000 + li * 100;
  for (let i = 0; i < PER; i++) {
    let p; for (;;) { try { p = makePuzzle(level, seed++); break; } catch { /* retry */ } }
    const bytes = [p.n, ...p.givens.flat(), ...p.solution.flat()];
    puzzles.push(bytes); json.push({ level: li, n: p.n, givens: p.givens, solution: p.solution });
  }
});
emit('number-chain', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
