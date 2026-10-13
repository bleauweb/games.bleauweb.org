/* Sudoku Calm: 4x4, 6x6 and 9x9 grids baked from the web game, each solvable with singles alone.
   A and B step a square's number up and down, SELECT gives a hint that names the single it used,
   and a number that clashes shows inverted until it is changed. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x5355
static const char *const LABELS[PUZ_LEVELS] = { "4 x 4", "6 x 6", "9 x 9, gentle", "9 x 9" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

uint8_t n, bw, bh, cell[81], given[81], sol[81], cx, cy, gx0, gy0;
static uint8_t level, idx;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = p[0]; bw = p[1]; bh = p[2]; p += 3;
  for (uint8_t i = 0; i < n * n; i++) { sol[i] = p[i] & 0x7F; given[i] = p[i] >> 7; cell[i] = given[i] ? sol[i] : 0; }
  uint8_t w = n + n / bw - 1, h = n + n / bh - 1;
  gx0 = (20 - w) / 2; gy0 = 1 + (14 - h) / 2;
  cx = cy = 0;
}
static uint8_t tx(uint8_t x) { return gx0 + x + x / bw; }
static uint8_t ty(uint8_t y) { return gy0 + y + y / bh; }
static bool clashes(uint8_t x, uint8_t y) {
  uint8_t v = cell[y * n + x]; if (!v) return false;
  for (uint8_t i = 0; i < n; i++) { if (i != x && cell[y * n + i] == v) return true; if (i != y && cell[i * n + x] == v) return true; }
  uint8_t bx = (x / bw) * bw, by = (y / bh) * bh;
  for (uint8_t yy = by; yy < by + bh; yy++) for (uint8_t xx = bx; xx < bx + bw; xx++) if ((xx != x || yy != y) && cell[yy * n + xx] == v) return true;
  return false;
}
static void draw_cell(uint8_t x, uint8_t y) {
  uint8_t i = y * n + x, v = cell[i], t;
  if (!v) t = GAME_BLANK;
  else if (given[i]) t = GAME_G1 + v - 1;
  else if (clashes(x, y)) t = GAME_X1 + v - 1;
  else t = GAME_D1 + v - 1;
  ui_tile(tx(x), ty(y), t);
}
static void draw_grid(void) {
  uint8_t w = n + n / bw - 1, h = n + n / bh - 1;
  for (uint8_t y = 0; y < h; y++) for (uint8_t x = 0; x < w; x++) {
    bool vx = (x + 1) % (bw + 1) == 0, vy = (y + 1) % (bh + 1) == 0;
    if (vx && vy) ui_tile(gx0 + x, gy0 + y, GAME_PLUS); else if (vx) ui_tile(gx0 + x, gy0 + y, COMMON_VLINE); else if (vy) ui_tile(gx0 + x, gy0 + y, COMMON_HLINE);
  }
  for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y);
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "SUDOKU CALM"); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  draw_grid();
  ui_text(0, 16, "A/B:number  SELECT:");
  ui_text(0, 17, "hint   START:menu");
}
static void msg(const char *a) { ui_fill(0, 14, 20, 2, 0); ui_text(0, 14, a); }
static void redraw_related(uint8_t x, uint8_t y) {
  for (uint8_t i = 0; i < n; i++) { draw_cell(i, y); draw_cell(x, i); }
  uint8_t bx = (x / bw) * bw, by = (y / bh) * bh;
  for (uint8_t yy = by; yy < by + bh; yy++) for (uint8_t xx = bx; xx < bx + bw; xx++) draw_cell(xx, yy);
}
static uint16_t cand_mask(uint8_t x, uint8_t y) {
  uint16_t used = 0;
  for (uint8_t i = 0; i < n; i++) { used |= 1 << cell[y * n + i]; used |= 1 << cell[i * n + x]; }
  uint8_t bx = (x / bw) * bw, by = (y / bh) * bh;
  for (uint8_t yy = by; yy < by + bh; yy++) for (uint8_t xx = bx; xx < bx + bw; xx++) used |= 1 << cell[yy * n + xx];
  uint16_t m = 0; for (uint8_t v = 1; v <= n; v++) if (!(used & (1 << v))) m |= 1 << v;
  return m;
}
static bool hint(void) {
  /* naked single first */
  for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) {
    if (cell[y * n + x]) continue;
    uint16_t m = cand_mask(x, y); uint8_t cnt = 0, v = 0;
    for (uint8_t k = 1; k <= n; k++) if (m & (1 << k)) { cnt++; v = k; }
    if (cnt == 1) { cell[y * n + x] = v; cx = x; cy = y; redraw_related(x, y); msg("Only one number fits"); ui_text(0, 15, "in this square:"); ui_num(16, 15, v, 1); return true; }
  }
  /* hidden single in a row, column or box */
  for (uint8_t v = 1; v <= n; v++) {
    for (uint8_t y = 0; y < n; y++) { uint8_t cnt = 0, fx = 0; bool has = false; for (uint8_t x = 0; x < n; x++) { if (cell[y * n + x] == v) has = true; else if (!cell[y * n + x] && (cand_mask(x, y) & (1 << v))) { cnt++; fx = x; } } if (!has && cnt == 1) { cell[y * n + fx] = v; cx = fx; cy = y; redraw_related(fx, y); msg("Row"); ui_num(3, 14, y + 1, 2); ui_text(6, 14, "has one place"); ui_text(0, 15, "left for a"); ui_num(11, 15, v, 1); return true; } }
    for (uint8_t x = 0; x < n; x++) { uint8_t cnt = 0, fy = 0; bool has = false; for (uint8_t y = 0; y < n; y++) { if (cell[y * n + x] == v) has = true; else if (!cell[y * n + x] && (cand_mask(x, y) & (1 << v))) { cnt++; fy = y; } } if (!has && cnt == 1) { cell[fy * n + x] = v; cx = x; cy = fy; redraw_related(x, fy); msg("Column"); ui_num(6, 14, x + 1, 2); ui_text(9, 14, "has one"); ui_text(0, 15, "place left for a"); ui_num(17, 15, v, 1); return true; } }
    for (uint8_t by = 0; by < n; by += bh) for (uint8_t bx = 0; bx < n; bx += bw) {
      uint8_t cnt = 0, fx = 0, fy = 0; bool has = false;
      for (uint8_t yy = by; yy < by + bh; yy++) for (uint8_t xx = bx; xx < bx + bw; xx++) { if (cell[yy * n + xx] == v) has = true; else if (!cell[yy * n + xx] && (cand_mask(xx, yy) & (1 << v))) { cnt++; fx = xx; fy = yy; } }
      if (!has && cnt == 1) { cell[fy * n + fx] = v; cx = fx; cy = fy; redraw_related(fx, fy); msg("This box has one"); ui_text(0, 15, "place left for a"); ui_num(17, 15, v, 1); return true; }
    }
  }
  return false;
}
static bool complete(void) { for (uint8_t i = 0; i < n * n; i++) if (cell[i] != sol[i]) return false; return true; }

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show(tx(cx) * 8, ty(cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    else if (keys_hit & (J_A | J_B)) {
      uint8_t i = cy * n + cx;
      if (given[i]) { sfx_bad(); msg("That one is given."); continue; }
      if (keys_hit & J_A) cell[i] = cell[i] == n ? 0 : cell[i] + 1; else cell[i] = cell[i] == 0 ? n : cell[i] - 1;
      sfx_tick(); redraw_related(cx, cy);
      if (complete()) {
        sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
        sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
        win_panel("Sudoku complete!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); return;
      }
    } else if (keys_hit & J_SELECT) {
      if (hint()) { sfx_ok(); if (complete()) { sfx_win(); sv.done |= 1 << level; sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv); win_screen("Sudoku complete!", "", ""); return; } }
      else { msg("No single found. Check"); ui_text(0, 15, "for a clash first."); sfx_bad(); }
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Check", "Start over", "Next puzzle", "Choose level" };
      uint8_t c = ui_menu("PAUSED", items, 5, 0);
      if (c == 2) load(); else if (c == 3) { idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; load(); } else if (c == 4) return;
      draw_all();
      if (c == 1) { uint8_t wrong = 0; for (uint8_t i = 0; i < n * n; i++) if (cell[i] && cell[i] != sol[i]) wrong++; if (wrong) { msg("Numbers not right:"); ui_num(18, 14, wrong, 2); } else msg("Everything so far fits."); }
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("SUDOKU CALM", "Every row, column", "and box holds each", "number once.");
  level = 0;
  while (1) {
    level = level_select("SUDOKU CALM", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
