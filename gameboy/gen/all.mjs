// Prepares everything the ROM tests read besides the ROMs themselves (npm pretest):
// the baked puzzles.json twins, and the tile headers (tile ids) from the ASCII tile art.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('./', import.meta.url);
const root = new URL('..', dir).pathname;
for (const f of fs.readdirSync(dir).filter((f) => /^[a-z-]+\.mjs$/.test(f) && !['all.mjs', 'emit.mjs', 'text.mjs', 'gbitems.mjs'].includes(f))) {
  execFileSync(process.execPath, [new URL(f, dir).pathname], { cwd: root, stdio: 'inherit' });
}
const py = (args) => execFileSync('python3', ['tools/tiles2c.py', ...args], { cwd: root, stdio: 'inherit' });
py(['common/common_tiles.txt', 'common/common_tiles', 'common', '128']);
py(['common/sprite_tiles.txt', 'common/sprite_tiles', 'sprites', '240']);
const common = fs.readFileSync(`${root}/common/common_tiles.h`, 'utf8');
const first = 128 + Number(/COMMON_COUNT (\d+)/.exec(common)[1]);
for (const g of fs.readdirSync(`${root}/games`)) {
  if (fs.existsSync(`${root}/games/${g}/tiles.txt`)) py([`games/${g}/tiles.txt`, `games/${g}/tiles`, 'game', String(first)]);
}
