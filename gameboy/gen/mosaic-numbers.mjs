import { LEVELS, makePuzzle } from '../../games/mosaic-numbers/src/mosaic.js';
import { emit, pack, rowMask } from './emit.mjs';
const PER = 6, STRIDE = 1 + 72 + 24;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  let seed = 9000 + li * 100;
  for (let i = 0; i < PER; i++) {
    let p; for (;;) { try { p = makePuzzle(level, seed++); break; } catch { /* retry */ } }
    const n = p.n, bytes = [n];
    const nib = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) nib.push(p.clues[y][x] == null ? 15 : p.clues[y][x]);
    if (nib.length & 1) nib.push(15);
    for (let i = 0; i < nib.length; i += 2) bytes.push(nib[i] | (nib[i + 1] << 4));
    for (let y = 0; y < n; y++) bytes.push(...rowMask(p.solution[y]));
    puzzles.push(bytes); json.push({ level: li, n, clues: p.clues, solution: p.solution });
  }
});
emit('mosaic-numbers', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
