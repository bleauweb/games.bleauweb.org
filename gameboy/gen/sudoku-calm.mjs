import { LEVELS, makePuzzle } from '../../games/sudoku-calm/src/sudoku.js';
import { emit, pack } from './emit.mjs';
const PER = 8, STRIDE = 3 + 81;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, 11000 + li * 100 + i);
    const bytes = [p.n, level.bw, level.bh];
    for (let y = 0; y < p.n; y++) for (let x = 0; x < p.n; x++) bytes.push(p.solution[y][x] | (p.givens[y][x] ? 0x80 : 0));
    puzzles.push(bytes); json.push({ level: li, n: p.n, bw: level.bw, bh: level.bh, givens: p.givens, solution: p.solution });
  }
});
emit('sudoku-calm', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
