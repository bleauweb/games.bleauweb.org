/* Number Chain (Hidato): the numbers 1 to n*n form one chain, each next to the one before it
   (sideways or diagonally). A on a number selects it; A on an empty square beside it writes the
   next number. SELECT switches between counting up and down. B erases a number you wrote. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x4E43
static const char *const LABELS[PUZ_LEVELS] = { "4 x 4", "5 x 5", "6 x 6", "7 x 7" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

uint8_t n, cells, cell[49], given[49], sol[49], cx, cy, gx0, gy0, sel, dir_up;
static uint8_t level, idx;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = *p++; cells = n * n;
  for (uint8_t i = 0; i < cells; i++) { cell[i] = p[i]; given[i] = p[i] != 0; }
  for (uint8_t i = 0; i < cells; i++) sol[i] = p[cells + i];
  gx0 = 8 - n; gy0 = 9 - n; cx = cy = 0; sel = 0; dir_up = 1;
}
static void draw_cell(uint8_t x, uint8_t y) {
  uint8_t i = y * n + x, v = cell[i], t[4];
  if (!v) { t[0] = GAME_LB; t[1] = GAME_RB; }
  else { t[0] = v >= 10 ? GAME_L0 + v / 10 : GAME_LB; t[1] = GAME_R0 + v % 10; }
  t[2] = given[i] || !v ? GAME_BL : GAME_BLU; t[3] = given[i] || !v ? GAME_BR : GAME_BRU;
  ui_tiles(gx0 + x * 2, gy0 + y * 2, 2, 2, t);
}
static void status(void) {
  ui_fill(0, 16, 20, 1, 0);
  if (sel) { ui_text(0, 16, "From"); ui_num(4, 16, sel, 3); ui_text(8, 16, dir_up ? "counting up" : "counting down"); }
  else ui_text(0, 16, "A: pick a number");
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "NUMBER CHAIN"); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y);
  status();
  ui_text(0, 17, "SELECT:up/down B:erase");
  ui_fill(0, 17, 20, 1, 0); ui_text(0, 17, "SELECT:direction");
}
static void msg(const char *s) { ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, s); }
static bool placed(uint8_t v) { for (uint8_t i = 0; i < cells; i++) if (cell[i] == v) return true; return false; }
static uint8_t find(uint8_t v) { for (uint8_t i = 0; i < cells; i++) if (cell[i] == v) return i; return 0xFF; }
static bool adjacent(uint8_t a, uint8_t b) {
  int8_t dx = (int8_t)(a % n) - (int8_t)(b % n), dy = (int8_t)(a / n) - (int8_t)(b / n);
  if (dx < 0) dx = -dx; if (dy < 0) dy = -dy;
  return dx <= 1 && dy <= 1 && (dx | dy);
}
static bool complete(void) {
  for (uint8_t i = 0; i < cells; i++) if (!cell[i]) return false;
  for (uint8_t v = 1; v < cells; v++) { uint8_t a = find(v), b = find(v + 1); if (a == 0xFF || b == 0xFF || !adjacent(a, b)) return false; }
  return true;
}

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((gx0 + cx * 2) * 8, (gy0 + cy * 2) * 8, 16);
    if (sel) { uint8_t s = find(sel); marker_show(0, (gx0 + (s % n) * 2) * 8 + 4, (gy0 + (s / n) * 2) * 8 - 6, SPRITES_DOT); } else marker_hide(0);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    else if (keys_hit & J_A) {
      uint8_t i = cy * n + cx;
      if (cell[i]) { sel = cell[i]; status(); msg(""); sfx_tick(); continue; }
      if (!sel) { sfx_bad(); msg("Pick a number first."); continue; }
      uint8_t s = find(sel);
      if (!adjacent(i, s)) { sfx_bad(); msg("Not next to it."); continue; }
      uint8_t v = dir_up ? sel + 1 : sel - 1;
      if (v == 0 || v > cells) { sfx_bad(); msg("The chain ends here."); continue; }
      if (placed(v)) { sfx_bad(); msg("Already placed."); continue; }
      cell[i] = v; draw_cell(cx, cy); sel = v; status(); msg(""); sfx_tick();
      if (complete()) {
        sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
        sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
        marker_hide(0); win_panel("Chain complete!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); return;
      }
    } else if (keys_hit & J_B) {
      uint8_t i = cy * n + cx;
      if (cell[i] && !given[i]) { if (sel == cell[i]) sel = 0; cell[i] = 0; draw_cell(cx, cy); status(); sfx_tick(); }
      else if (given[i]) { sfx_bad(); msg("That one is given."); }
    } else if (keys_hit & J_SELECT) { dir_up ^= 1; status(); sfx_tick(); }
    else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Check", "Start over", "Next puzzle", "Choose size" };
      uint8_t c = ui_menu("PAUSED", items, 5, 0);
      if (c == 2) load(); else if (c == 3) { idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; load(); } else if (c == 4) { marker_hide(0); return; }
      draw_all();
      if (c == 1) { uint8_t wrong = 0; for (uint8_t i = 0; i < cells; i++) if (cell[i] && cell[i] != sol[i]) wrong++; if (wrong) { msg("Numbers misplaced:"); ui_num(18, 15, wrong, 2); } else msg("Everything fits."); }
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("NUMBER CHAIN", "1 to the end, each", "number touching the", "one before it.");
  level = 0;
  while (1) {
    level = level_select("NUMBER CHAIN", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
