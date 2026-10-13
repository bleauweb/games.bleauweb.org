/* Tile Logic: nonograms. The numbers say how long the runs of filled squares are, in order.
   A fills, B marks a square empty, SELECT checks. Every puzzle can be finished by logic alone;
   finished lines show their clues faded. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x544C
static const char *const LABELS[PUZ_LEVELS] = { "5 x 5", "8 x 8", "Pictures 10x10", "Pictures, turned" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

uint8_t n, cx, cy, gx0, gy0, rcn[10], ccn[10], rclue[10][5], cclue[10][5];
uint16_t sol[10], fill[10], mark[10];
static uint8_t level, idx, maxr, maxc, wrong[10];

static uint8_t clues_of(uint16_t bits, uint8_t *out) {
  uint8_t k = 0, run = 0;
  for (uint8_t i = 0; i < n; i++) {
    if (bits & (1 << i)) run++;
    else if (run) { out[k++] = run; run = 0; }
  }
  if (run) out[k++] = run;
  return k;
}
static uint16_t col_bits(uint16_t *rows, uint8_t x) { uint16_t b = 0; for (uint8_t y = 0; y < n; y++) if (rows[y] & (1 << x)) b |= 1 << y; return b; }
static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = *p++;
  for (uint8_t y = 0; y < n; y++) { sol[y] = p[0] | (p[1] << 8); p += 2; fill[y] = mark[y] = 0; }
  maxr = maxc = 1;
  for (uint8_t y = 0; y < n; y++) { rcn[y] = clues_of(sol[y], rclue[y]); if (rcn[y] > maxr) maxr = rcn[y]; }
  for (uint8_t x = 0; x < n; x++) { ccn[x] = clues_of(col_bits(sol, x), cclue[x]); if (ccn[x] > maxc) maxc = ccn[x]; }
  gx0 = maxr; gy0 = 1 + maxc;
  if (gx0 + n < 16) gx0 = (16 - n + maxr) / 2 + 0;   /* centre small grids a little */
  cx = cy = 0; memset(wrong, 0, sizeof wrong);
}
static bool row_done(uint8_t y) { uint8_t c[5]; uint8_t k = clues_of(fill[y], c); if (k != rcn[y]) return false; for (uint8_t i = 0; i < k; i++) if (c[i] != rclue[y][i]) return false; return true; }
static bool col_done(uint8_t x) { uint8_t c[5]; uint8_t k = clues_of(col_bits(fill, x), c); if (k != ccn[x]) return false; for (uint8_t i = 0; i < k; i++) if (c[i] != cclue[x][i]) return false; return true; }
static void draw_row_clues(uint8_t y) {
  bool done = row_done(y);
  for (uint8_t i = 0; i < maxr; i++) ui_tile(gx0 - maxr + i, gy0 + y, 0);
  for (uint8_t i = 0; i < rcn[y]; i++) ui_tile(gx0 - rcn[y] + i, gy0 + y, (done ? GAME_F1 : GAME_C1) + rclue[y][i] - 1);
}
static void draw_col_clues(uint8_t x) {
  bool done = col_done(x);
  for (uint8_t i = 0; i < maxc; i++) ui_tile(gx0 + x, gy0 - maxc + i, 0);
  for (uint8_t i = 0; i < ccn[x]; i++) ui_tile(gx0 + x, gy0 - ccn[x] + i, (done ? GAME_F1 : GAME_C1) + cclue[x][i] - 1);
}
static void draw_cell(uint8_t x, uint8_t y) {
  uint16_t b = 1 << x; uint8_t t;
  if (wrong[y] & b) t = GAME_WRONG;
  else if (fill[y] & b) t = COMMON_BOX_FILL;
  else if (mark[y] & b) t = COMMON_BOX_X;
  else t = COMMON_BOX;
  ui_tile(gx0 + x, gy0 + y, t);
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "TILE LOGIC"); ui_text(13, 0, "No."); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  for (uint8_t y = 0; y < n; y++) { draw_row_clues(y); for (uint8_t x = 0; x < n; x++) draw_cell(x, y); }
  for (uint8_t x = 0; x < n; x++) draw_col_clues(x);
  ui_text(0, 16, "A:fill B:mark empty");
  ui_text(0, 17, "SELECT:check");
}
static void msg(const char *s) { ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, s); }
static bool solved(void) { for (uint8_t y = 0; y < n; y++) if (!row_done(y)) return false; for (uint8_t x = 0; x < n; x++) if (!col_done(x)) return false; return true; }
static void after_change(uint8_t x, uint8_t y) {
  draw_cell(x, y); draw_row_clues(y); draw_col_clues(x);
  if (solved()) {
    sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
    sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
    win_panel("Picture complete!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait();
  }
}

static bool play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((gx0 + cx) * 8, (gy0 + cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    else if (keys_hit & J_A) {
      uint16_t b = 1 << cx; fill[cy] ^= b; mark[cy] &= ~b; wrong[cy] &= ~b; sfx_tick();
      bool was = solved(); after_change(cx, cy); if (!was && solved()) return true;
    } else if (keys_hit & J_B) {
      uint16_t b = 1 << cx; mark[cy] ^= b; fill[cy] &= ~b; wrong[cy] &= ~b; sfx_tick();
      after_change(cx, cy); if (solved()) return true;
    } else if (keys_hit & J_SELECT) {
      uint8_t cnt = 0;
      for (uint8_t y = 0; y < n; y++) { wrong[y] = fill[y] & ~sol[y]; for (uint8_t x = 0; x < n; x++) { if (wrong[y] & (1 << x)) cnt++; draw_cell(x, y); } }
      if (cnt) { msg("X = not in picture."); sfx_bad(); } else { msg("Nothing wrong so far."); sfx_ok(); }
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Start over", "Next puzzle", "Choose level" };
      uint8_t c = ui_menu("PAUSED", items, 4, 0);
      if (c == 1) load(); else if (c == 2) { idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; load(); } else if (c == 3) return false;
      draw_all();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("TILE LOGIC", "Numbers tell you", "the runs of filled", "squares, in order.");
  level = 0;
  while (1) {
    level = level_select("TILE LOGIC", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
