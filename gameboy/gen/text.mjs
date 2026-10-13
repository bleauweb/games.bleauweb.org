// Wrap text into Game Boy rows (20 columns) and emit a C string table.
export function wrap(text, width = 20, lines = 3) {
  const out = []; let cur = '';
  for (const w of String(text).replace(/\s+/g, ' ').trim().split(' ')) {
    if ((cur + ' ' + w).trim().length > width) { out.push(cur.trim()); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur.trim());
  return out.slice(0, lines).map((l) => l.slice(0, width)).join('\n');
}
export function cStrings(name, strings) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  return `const char *const ${name}[${strings.length}] = {\n${strings.map((s) => `  "${esc(s)}",`).join('\n')}\n};\n`;
}
export class Strings { constructor() { this.list = []; this.map = new Map(); } add(s) { if (!this.map.has(s)) { this.map.set(s, this.list.length); this.list.push(s); } return this.map.get(s); } }
