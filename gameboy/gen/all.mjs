// Runs every baker so the ROM tests have their puzzles.json twins (npm pretest).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('./', import.meta.url);
for (const f of fs.readdirSync(dir).filter((f) => /^[a-z-]+\.mjs$/.test(f) && !['all.mjs', 'emit.mjs', 'text.mjs', 'gbitems.mjs'].includes(f))) {
  execFileSync(process.execPath, [new URL(f, dir).pathname], { cwd: new URL('..', dir).pathname, stdio: 'inherit' });
}
