/* Binary Grid (Takuzu): fill every square dark or light so each row and column has the same number of
   each, never three alike in a row, and no two rows or columns the same. A cycles a square, B checks,
   SELECT fills one square for you. Puzzles are baked from the web game's generator: every one has
   exactly one solution and never needs a guess. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x4247
static const char *const LABELS[PUZ_LEVELS] = { "4 x 4", "6 x 6", "8 x 8", "10 x 10" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

uint8_t n, cell[100], given[100], sol[100], bad[100], cx, cy, gx0, gy0;
static uint8_t level, idx;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = *p++;
  for (uint8_t y = 0; y < n; y++) {
    uint16_t gm = p[0] | (p[1] << 8), vm = p[2] | (p[3] << 8); p += 4;
    for (uint8_t x = 0; x < n; x++) {
      uint8_t i = y * n + x;
      sol[i] = (vm >> x) & 1 ? 2 : 1;
      given[i] = (gm >> x) & 1;
      cell[i] = given[i] ? sol[i] : 0;
    }
  }
  memset(bad, 0, sizeof bad);
  cx = cy = 0;
  gx0 = 1; gy0 = 2;
}
static void draw_cell(uint8_t x, uint8_t y) {
  uint8_t i = y * n + x, t;
  if (given[i]) t = cell[i] == 1 ? GAME_ZERO_G : GAME_ONE_G;
  else if (bad[i]) t = cell[i] == 1 ? GAME_ZERO_BAD : GAME_ONE_BAD;
  else t = cell[i] == 0 ? GAME_BLANK : cell[i] == 1 ? GAME_ZERO : GAME_ONE;
  ui_tile(gx0 + x, gy0 + y, t);
}
static void draw_grid(void) { for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y); }
static void msg(const char *a, const char *b) { ui_fill(0, 14, 20, 2, 0); ui_text(0, 14, a); ui_text(0, 15, b); }
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "BINARY GRID"); ui_text(13, 0, "No."); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  draw_grid();
  ui_text(13, 3, "Same"); ui_text(13, 4, "count"); ui_text(13, 5, "of each");
  ui_text(13, 7, "Never"); ui_text(13, 8, "three"); ui_text(13, 9, "alike");
  ui_text(13, 11, "No two"); ui_text(13, 12, "lines"); ui_text(13, 13, "same");
  ui_fill(0, 14, 20, 2, 0);
  ui_text(0, 16, "A:colour B:check");
  ui_text(0, 17, "SELECT:help START:menu");
  ui_fill(0, 17, 20, 1, 0); ui_text(0, 17, "SELECT:fill one");
}
/* returns 0 ok, 1 three in a row, 2 too many of one kind; line = row y (col=0) or column x */
static uint8_t line_problem(uint8_t k, uint8_t is_col) {
  uint8_t a = 0, b = 0, run = 1, prev = 0;
  for (uint8_t i = 0; i < n; i++) {
    uint8_t v = is_col ? cell[i * n + k] : cell[k * n + i];
    if (v && v == prev) { run++; if (run >= 3) return 1; } else run = 1;
    prev = v;
    if (v == 1) a++; else if (v == 2) b++;
  }
  if (a > n / 2 || b > n / 2) return 2;
  return 0;
}
static bool line_full(uint8_t k, uint8_t is_col) { for (uint8_t i = 0; i < n; i++) if (!(is_col ? cell[i * n + k] : cell[k * n + i])) return false; return true; }
static bool lines_equal(uint8_t a, uint8_t b, uint8_t is_col) { for (uint8_t i = 0; i < n; i++) { uint8_t va = is_col ? cell[i * n + a] : cell[a * n + i], vb = is_col ? cell[i * n + b] : cell[b * n + i]; if (va != vb) return false; } return true; }
static void mark_bad(void) {
  uint8_t cnt = 0;
  for (uint8_t i = 0; i < n * n; i++) { uint8_t was = bad[i]; bad[i] = cell[i] && !given[i] && cell[i] != sol[i]; if (bad[i] != was) draw_cell(i % n, i / n); if (bad[i]) cnt++; }
  if (cnt) { msg("Squares with a dark", "edge are wrong."); return; }
}
static bool check(void) {
  for (uint8_t k = 0; k < n; k++) for (uint8_t c = 0; c < 2; c++) {
    uint8_t p = line_problem(k, c);
    if (p) {
      ui_fill(0, 14, 20, 2, 0);
      ui_text(0, 14, c ? "Column" : "Row"); ui_num(c ? 7 : 4, 14, k + 1, 2);
      ui_text(0, 15, p == 1 ? "has three alike." : "has too many of one.");
      return false;
    }
  }
  for (uint8_t c = 0; c < 2; c++) for (uint8_t a = 0; a < n; a++) if (line_full(a, c)) for (uint8_t b = a + 1; b < n; b++) if (line_full(b, c) && lines_equal(a, b, c)) {
    ui_fill(0, 14, 20, 2, 0); ui_text(0, 14, c ? "Two columns are" : "Two rows are"); ui_text(0, 15, "the same."); return false;
  }
  return true;
}
static bool complete(void) { for (uint8_t i = 0; i < n * n; i++) if (!cell[i]) return false; return true; }

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((gx0 + cx) * 8, (gy0 + cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    else if (keys_hit & J_A) {
      uint8_t i = cy * n + cx;
      if (given[i]) { sfx_bad(); msg("That one is given.", ""); continue; }
      cell[i] = (cell[i] + 1) % 3; bad[i] = 0; draw_cell(cx, cy); sfx_tick();
      if (complete()) {
        if (check()) {
          sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
          sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
          win_panel("Grid complete!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); return;
        } else sfx_bad();
      }
    } else if (keys_hit & J_B) { if (check()) { mark_bad(); if (!complete()) { bool any = false; for (uint8_t i = 0; i < n * n; i++) if (bad[i]) any = true; if (!any) msg("All good so far.", ""); } } else sfx_bad(); }
    else if (keys_hit & J_SELECT) {
      /* fill one empty square from the solution, nearest to the cursor in reading order */
      uint8_t i = cy * n + cx, found = 0xFF;
      for (uint8_t k = 0; k < n * n; k++) { uint8_t j = (i + k) % (n * n); if (!cell[j]) { found = j; break; } }
      if (found != 0xFF) { cell[found] = sol[found]; bad[found] = 0; cx = found % n; cy = found / n; draw_cell(cx, cy); sfx_ok(); msg("One square filled in.", ""); }
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Start over", "Next puzzle", "Choose size" };
      uint8_t c = ui_menu("PAUSED", items, 4, 0);
      if (c == 1) load(); else if (c == 2) { idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; load(); } else if (c == 3) return;
      draw_all();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("BINARY GRID", "Dark or light in", "every square. Same", "count, never three.");
  level = 0;
  while (1) {
    level = level_select("BINARY GRID", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
