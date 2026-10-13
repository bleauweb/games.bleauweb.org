/* Pattern Weaver: a 16 x 16 canvas, four shades, and symmetry that paints with you.
   A paints, B picks the next shade, SELECT changes the symmetry, START opens fill, clear, save and load.
   There is nothing to get wrong here. */
#include "common.h"
#include <string.h>

#define MAGIC 0x5057
#define N 16
typedef struct { uint8_t slots[3][64]; uint8_t used; } save_t;  /* 2 bits per cell */
static save_t sv;
uint8_t grid[N * N], cx, cy, shade = 3, sym = 1;
#define NMODES 8
static const char *const MODE_NAME[NMODES] = { "free", "mirror  <->", "mirror  ^v", "four-way", "turn x4", "kaleido", "tile 4x4", "tile 8x8" };
static const uint8_t SHADE_TILE[4] = { COMMON_SOLID0, COMMON_SOLID1, COMMON_SOLID2, COMMON_SOLID3 };

static void draw_cell(uint8_t x, uint8_t y) { ui_tile(x, 1 + y, SHADE_TILE[grid[y * N + x]]); }
static void draw_grid(void) { for (uint8_t y = 0; y < N; y++) for (uint8_t x = 0; x < N; x++) draw_cell(x, y); }
static void draw_panel(void) {
  ui_fill(16, 0, 4, 18, 0);
  ui_text(17, 1, "ink");
  for (uint8_t s = 0; s < 4; s++) { ui_tile(17, 3 + s * 2, SHADE_TILE[s]); ui_tile(18, 3 + s * 2, s == shade ? COMMON_CHECK : 0); }
  ui_text(17, 12, "sym");
  ui_num(17, 13, sym, 2);
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "PATTERN WEAVER");
  draw_grid(); draw_panel();
  ui_fill(0, 17, 20, 1, 0); ui_text(0, 17, MODE_NAME[sym]);
}
static void set(uint8_t x, uint8_t y, uint8_t v) { if (x < N && y < N && grid[y * N + x] != v) { grid[y * N + x] = v; draw_cell(x, y); } }
static void paint(uint8_t x, uint8_t y, uint8_t v) {
  uint8_t m = N - 1;
  set(x, y, v);
  switch (sym) {
    case 1: set(m - x, y, v); break;
    case 2: set(x, m - y, v); break;
    case 3: set(m - x, y, v); set(x, m - y, v); set(m - x, m - y, v); break;
    case 4: set(m - y, x, v); set(m - x, m - y, v); set(y, m - x, v); break;
    case 5: set(m - x, y, v); set(x, m - y, v); set(m - x, m - y, v);
            set(y, x, v); set(m - y, x, v); set(y, m - x, v); set(m - y, m - x, v); break;
    case 6: for (uint8_t yy = y & 3; yy < N; yy += 4) for (uint8_t xx = x & 3; xx < N; xx += 4) set(xx, yy, v); break;
    case 7: for (uint8_t yy = y & 7; yy < N; yy += 8) for (uint8_t xx = x & 7; xx < N; xx += 8) set(xx, yy, v); break;
  }
}
static void flood(uint8_t x, uint8_t y, uint8_t v) {
  uint8_t from = grid[y * N + x]; if (from == v) return;
  static uint8_t stack[256]; uint8_t sp = 0; stack[sp++] = y * N + x; grid[y * N + x] = v;
  while (sp) {
    uint8_t i = stack[--sp]; uint8_t px = i % N, py = i / N; draw_cell(px, py);
    if (px && grid[i - 1] == from) { grid[i - 1] = v; stack[sp++] = i - 1; }
    if (px < N - 1 && grid[i + 1] == from) { grid[i + 1] = v; stack[sp++] = i + 1; }
    if (py && grid[i - N] == from) { grid[i - N] = v; stack[sp++] = i - N; }
    if (py < N - 1 && grid[i + N] == from) { grid[i + N] = v; stack[sp++] = i + N; }
  }
}
static void surprise(void) {
  uint8_t saved = sym; sym = 3 + rng_range(3);
  memset(grid, 0, sizeof grid);
  for (uint8_t k = 0; k < 24; k++) paint(rng_range(N), rng_range(N), 1 + rng_range(3));
  sym = saved; draw_grid();
}
static void pack(uint8_t *dst) { for (uint8_t i = 0; i < 64; i++) dst[i] = grid[i * 4] | (grid[i * 4 + 1] << 2) | (grid[i * 4 + 2] << 4) | (grid[i * 4 + 3] << 6); }
static void unpack(const uint8_t *src) { for (uint8_t i = 0; i < 64; i++) { grid[i * 4] = src[i] & 3; grid[i * 4 + 1] = (src[i] >> 2) & 3; grid[i * 4 + 2] = (src[i] >> 4) & 3; grid[i * 4 + 3] = src[i] >> 6; } }

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  title_screen("PATTERN WEAVER", "Paint. The symmetry", "paints with you.", "Nothing to get wrong.");
  memset(grid, 0, sizeof grid);
  draw_all();
  while (1) {
    cursor_show(cx * 8, (1 + cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < N - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < N - 1) cy++;
    if (keys & J_A) { paint(cx, cy, shade); if (keys_hit & J_A) sfx_tick(); }
    if (keys_hit & J_B) { shade = (shade + 1) & 3; draw_panel(); sfx_tick(); }
    if (keys_hit & J_SELECT) { sym = (sym + 1) % NMODES; draw_panel(); ui_fill(0, 17, 20, 1, 0); ui_text(0, 17, MODE_NAME[sym]); sfx_tick(); }
    if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Fill from cursor", "Surprise me", "Clear", "Save slot 1", "Save slot 2", "Save slot 3", "Load slot 1", "Load slot 2", "Load slot 3" };
      uint8_t c = ui_menu("WEAVER", items, 10, 0);
      if (c == 1) { draw_all(); flood(cx, cy, shade); sfx_ok(); continue; }
      if (c == 2) surprise();
      else if (c == 3) memset(grid, 0, sizeof grid);
      else if (c >= 4 && c <= 6) { pack(sv.slots[c - 4]); sv.used |= 1 << (c - 4); save_store(MAGIC, &sv, sizeof sv); sfx_ok(); }
      else if (c >= 7) { if (sv.used & (1 << (c - 7))) { unpack(sv.slots[c - 7]); sfx_ok(); } else sfx_bad(); }
      draw_all();
    }
  }
}
