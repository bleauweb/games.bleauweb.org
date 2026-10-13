import { LEVELS, makePuzzle, PIECES } from '../../games/tangram-fit/src/tangram.js';
import { emit, pack, rowMask } from './emit.mjs';
const NAMES = Object.keys(PIECES);
const PER = 6, STRIDE = 2 + 20 + 1 + 8;
const puzzles = [], json = [];
LEVELS.forEach((level, li) => {
  for (let i = 0; i < PER; i++) {
    const p = makePuzzle(level, 19000 + li * 100 + i);
    const rows = Array.from({ length: p.h }, (_, y) => Array.from({ length: p.w }, (_, x) => p.silhouette.has(`${x},${y}`) ? 1 : 0));
    const bytes = [p.w, p.h];
    for (let y = 0; y < 10; y++) bytes.push(...rowMask(rows[y] || []));
    bytes.push(p.pieces.length, ...p.pieces.map((pc) => NAMES.indexOf(pc.name)));
    puzzles.push(bytes); json.push({ level: li, w: p.w, h: p.h, rows, pieces: p.pieces.map((pc) => pc.name), solution: p.solution });
  }
});
const shapes = []; // 18 pieces x 5 cells x (x,y); unused cells 0xFF
for (const name of NAMES) { const cells = PIECES[name]; for (let k = 0; k < 5; k++) shapes.push(...(cells[k] || [0xFF, 0xFF])); }
emit('tangram-fit', { defines: { PUZ_PER_LEVEL: PER, PUZ_STRIDE: STRIDE, PUZ_LEVELS: LEVELS.length, NPIECES: NAMES.length }, arrays: { PUZ: pack(puzzles, STRIDE), SHAPES: shapes }, json: { puzzles: json, names: NAMES } });
