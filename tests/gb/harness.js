// Headless Game Boy harness around serverboy: boots a ROM from public/roms, presses keys,
// Note: serverboy's doFrame() advances about half an LCD frame, so holds and settles below are in
// those half-frames; a key must be held for 3 real frames to be sure the once-per-VBL joypad read sees it.
// and reads the background tile map back as text (font tiles are char - 32).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const Gameboy = require('serverboy');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

export const KEYS = Gameboy.KEYMAP;

export function boot(slug, { frames = 150, sram } = {}) {
  const gb = new Gameboy();
  const rom = fs.readFileSync(path.join(ROOT, 'public/roms', `${slug}.gb`));
  gb.loadRom(rom, sram);
  const core = gb[Object.keys(gb)[0]].gameboy;
  let noi = null;
  try { noi = fs.readFileSync(path.join(ROOT, 'public/roms', `${slug}.noi`), 'utf8'); } catch { /* no map */ }
  const g = {
    // address of a C global from the linker map (static variables are not listed)
    sym(name) { const m = noi && new RegExp(`DEF _${name} (?:0x)?([0-9A-Fa-f]+)`).exec(noi); if (!m) throw new Error(`no symbol ${name}`); return parseInt(m[1], 16); },
    mem(addr, len = 1) { if (typeof addr === 'string') addr = g.sym(addr); return Array.from(core.memory.slice(addr, addr + len)); },
    gb, core, slug,
    frames(n) { for (let i = 0; i < n; i++) gb.doFrame(); return g; },
    tap(key, { hold = 6, settle = 20 } = {}) {
      for (let i = 0; i < hold; i++) { gb.pressKey(KEYS[key]); gb.doFrame(); }
      g.frames(settle); return g;
    },
    taps(keys, opts) { for (const k of keys) g.tap(k, opts); return g; },
    hold(key, n) { for (let i = 0; i < n; i++) { gb.pressKey(KEYS[key]); gb.doFrame(); } return g; },
    tile(x, y) { return core.BGCHRBank1[y * 32 + x]; },
    rows() {
      const out = [];
      for (let y = 0; y < 18; y++) {
        let s = '';
        for (let x = 0; x < 20; x++) { const t = g.tile(x, y); s += t < 96 ? String.fromCharCode(t + 32) : '#'; }
        out.push(s);
      }
      return out;
    },
    text() { return g.rows().join('\n'); },
    // advance until the screen shows str (or a predicate holds); throws after max frames
    until(what, max = 300) {
      const ok = typeof what === 'function' ? what : () => g.has(what);
      for (let i = 0; i < max; i++) { if (ok()) return g; gb.doFrame(); }
      throw new Error(`timed out waiting for ${what}\n${g.text()}`);
    },
    has(str) { return g.rows().some((r) => r.includes(str)); },
    find(str) { const i = g.rows().findIndex((r) => r.includes(str)); return i < 0 ? null : { y: i, x: g.rows()[i].indexOf(str) }; },
    sram() { return gb.getSaveData(); },
    png(file) {
      const s = gb.getScreen();
      const buf = Buffer.alloc(160 * 144 * 3);
      for (let i = 0, j = 0; i < s.length; i += 4, j += 3) { buf[j] = s[i]; buf[j + 1] = s[i + 1]; buf[j + 2] = s[i + 2]; }
      const ppm = file.replace(/\.png$/, '.ppm');
      fs.writeFileSync(ppm, Buffer.concat([Buffer.from('P6\n160 144\n255\n'), buf]));
      execFileSync('sips', ['-s', 'format', 'png', ppm, '--out', file], { stdio: 'ignore' });
      execFileSync('sips', ['-z', '432', '480', file, '--out', file], { stdio: 'ignore' });
      fs.unlinkSync(ppm);
      return g;
    },
    // move the standard cursor from (cx,cy) to (tx,ty) with taps
    moveTo(cur, tx, ty) {
      while (cur.x < tx) { g.tap('RIGHT'); cur.x++; }
      while (cur.x > tx) { g.tap('LEFT'); cur.x--; }
      while (cur.y < ty) { g.tap('DOWN'); cur.y++; }
      while (cur.y > ty) { g.tap('UP'); cur.y--; }
      return g;
    },
  };
  return g.frames(frames);
}
