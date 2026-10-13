import { LEVELS, makePuzzle } from '../../games/symmetry-studio/src/symmetry.js';
import { emit, pack, rowMask } from './emit.mjs';
const PER = 6, STRIDE = 2 + 22 + 61;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, 15000 + li * 100 + i);
    const n = p.n, bytes = [n, p.colors];
    // given mask: a cell is a source (shown, locked) when isSource; the web marks sources via given==target on source cells
    // makePuzzle keeps target values only on source cells, so "source" = cells where given was copied; recover from the mode:
    for (let y = 0; y < n; y++) bytes.push(...rowMask(p.given[y].map((v, x) => p.srcMask ? p.srcMask[y][x] : isSrc(level.mode, n, x, y))));
    const nib = p.target.flat(); if (nib.length & 1) nib.push(0);
    for (let k = 0; k < nib.length; k += 2) bytes.push(nib[k] | (nib[k + 1] << 4));
    puzzles.push(bytes); json.push({ level: li, n, colors: p.colors, mode: level.mode, given: p.given, target: p.target, source: p.target.map((r, y) => r.map((_, x) => isSrc(level.mode, n, x, y))) });
  }
});
import { isSource } from '../../games/symmetry-studio/src/symmetry.js';
function isSrc(mode, n, x, y) { return isSource(mode, n, x, y); }
emit('symmetry-studio', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length }, arrays: { PUZ: pack(puzzles, STRIDE) }, json });
