#!/usr/bin/env python3
"""Turn ASCII tile art into GBDK 2bpp tile data.

Input: blocks of `# NAME` followed by 8 rows of 8 chars drawn with . 1 2 3 (shades 0-3).
A block may hold 16 rows x 16 cols for a 2x2 metatile (NAME gets 4 tiles: TL, TR, BL, BR).
Output: <out>.c with `const uint8_t <set>_tiles[]` and <out>.h with `#define <set>_NAME <index>`.
"""
import sys, re
src, out, setname, first = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
blocks, cur, name = [], [], None
for line in open(src):
    line = line.rstrip('\n')
    if line.startswith('#'):
        if name is not None: blocks.append((name, cur))
        name, cur = line[1:].strip(), []
    elif line.strip():
        cur.append(line.strip())
if name is not None: blocks.append((name, cur))
def tile_bytes(rows):
    b = []
    for r in rows:
        lo = hi = 0
        for i, ch in enumerate(r):
            v = 0 if ch == '.' else int(ch)
            if v & 1: lo |= 0x80 >> i
            if v & 2: hi |= 0x80 >> i
        b += [lo, hi]
    return b
data, defs, idx = [], [], first
for name, rows in blocks:
    if len(rows) == 8 and len(rows[0]) == 8:
        data += tile_bytes(rows); defs.append((name, idx)); idx += 1
    elif len(rows) == 16 and len(rows[0]) == 16:
        defs.append((name, idx))
        for (ry, rx) in ((0, 0), (0, 8), (8, 0), (8, 8)):
            data += tile_bytes([r[rx:rx + 8] for r in rows[ry:ry + 8]]); idx += 1
    else:
        sys.exit(f'bad block {name}: {len(rows)} rows')
with open(out + '.c', 'w') as f:
    f.write('#include <stdint.h>\n#include "%s.h"\n' % out.split('/')[-1])
    f.write('const uint8_t %s_tiles[] = {\n' % setname)
    for i in range(0, len(data), 16):
        f.write('  ' + ', '.join('0x%02X' % v for v in data[i:i + 16]) + ',\n')
    f.write('};\n')
with open(out + '.h', 'w') as f:
    g = re.sub(r'\W', '_', setname).upper()
    f.write('#ifndef %s_TILES_H\n#define %s_TILES_H\n#include <stdint.h>\n' % (g, g))
    f.write('extern const uint8_t %s_tiles[];\n' % setname)
    f.write('#define %s_FIRST %d\n#define %s_COUNT %d\n' % (g, first, g, idx - first))
    for n, i in defs: f.write('#define %s_%s %d\n' % (g, n, i))
    f.write('#endif\n')
print(f'{out}: {idx - first} tiles from {first}')
