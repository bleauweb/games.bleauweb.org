"""3x5 digit glyphs and helpers to author 8x8 'digit in a cell' tiles as ASCII art."""
DIG = {
 '0': ["111","101","101","101","111"], '1': ["010","110","010","010","111"], '2': ["111","001","111","100","111"],
 '3': ["111","001","111","001","111"], '4': ["101","101","111","001","001"], '5': ["111","100","111","001","111"],
 '6': ["111","100","111","101","111"], '7': ["111","001","001","001","001"], '8': ["111","101","111","101","111"],
 '9': ["111","101","111","001","111"],
}
def cell(bg='.', border='2', digit=None, ink='3', dx=2, dy=1):
    rows = [[border]*8] + [[border] + [bg]*6 + [border] for _ in range(6)] + [[border]*8]
    if digit is not None:
        g = DIG[digit]
        for y, r in enumerate(g):
            for x, c in enumerate(r):
                if c == '1': rows[dy + y + 0][dx + x] = ink
    return [''.join(r) for r in rows]
def two_digit(a, b, bg='.', border='2', ink='3'):
    rows = [[border]*8] + [[border] + [bg]*6 + [border] for _ in range(6)] + [[border]*8]
    for i, d in enumerate((a, b)):
        g = DIG[d]
        for y, r in enumerate(g):
            for x, c in enumerate(r):
                if c == '1': rows[1 + y][1 + i * 3 + x] = ink
    return [''.join(r) for r in rows]
def block(name, rows): return ['# ' + name] + rows
