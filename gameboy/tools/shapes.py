"""Shape tiles shared by Sequence Lab, Odd One Out and Sort and Stack.
Five shapes x three fills (solid, outline, striped), as 8x8 'small' tiles and 16x16 'large' metatiles.
Item code used by the ROMs: shape | fill<<3 | size<<5 | (count-1)<<6."""
import math
SHAPES = ['circle', 'square', 'triangle', 'star', 'hexagon']
FILLS = ['solid', 'outline', 'striped']
def canvas(n): return [[0]*n for _ in range(n)]
def inside_fn(shape, n):
    c = n / 2.0
    if shape == 'circle':
        r = n * 0.44
        return lambda x, y: (x - c) ** 2 + (y - c) ** 2 <= r * r
    if shape == 'square':
        m = n * 0.12
        return lambda x, y: m <= x <= n - m and m <= y <= n - m
    if shape == 'triangle':
        return lambda x, y: y >= n * 0.1 and abs(x - c) <= (y - n * 0.1) * 0.58 and y <= n * 0.92
    if shape == 'hexagon':
        r = n * 0.46
        def f(x, y):
            dx, dy = abs(x - c), abs(y - c)
            return dx <= r * 0.87 and dy <= r and dy <= -0.577 * dx + r * 1.0 + 0.01
        return f
    if shape == 'star':
        R, r = n * 0.48, n * 0.2
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rr = R if i % 2 == 0 else r
            pts.append((c + rr * math.cos(a), c + rr * math.sin(a)))
        def f(x, y):
            inside = False
            j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]; xj, yj = pts[j]
                if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: inside = not inside
                j = i
            return inside
        return f
def raster(shape, fill, n):
    f = inside_fn(shape, n)
    grid = canvas(n)
    for y in range(n):
        for x in range(n):
            if f(x + 0.5, y + 0.5): grid[y][x] = 3
    if fill != 'solid':
        # outline = cells inside with a neighbour outside
        out = canvas(n)
        for y in range(n):
            for x in range(n):
                if grid[y][x]:
                    edge = any(not (0 <= y + dy < n and 0 <= x + dx < n and grid[y + dy][x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if edge: out[y][x] = 3
                    elif fill == 'striped' and (x + y) % 3 == 0: out[y][x] = 3
                    elif fill == 'striped' and n == 8 and (x + y) % 2 == 0: out[y][x] = 3
        grid = out
    return [''.join('.123'[v] for v in row) for row in grid]
def blocks():
    out = []
    for si, s in enumerate(SHAPES):
        for fi, f in enumerate(FILLS):
            out += ['# S%d%d' % (si, fi)] + raster(s, f, 8)
    for si, s in enumerate(SHAPES):
        for fi, f in enumerate(FILLS):
            out += ['# L%d%d' % (si, fi)] + raster(s, f, 16)
    return out
if __name__ == '__main__':
    import sys
    open(sys.argv[1], 'w').write('\n'.join(blocks()) + '\n')
