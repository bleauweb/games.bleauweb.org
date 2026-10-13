/* Slide Picture: the sliding-tile puzzle. The d-pad slides the tile on that side of the gap into it.
   Scrambles are made by legal moves, so every board can be solved. SELECT peeks at the finished picture. */
#include "common.h"
#include "tiles.h"
#include "pictures.h"
#include <string.h>

#define MAGIC 0x534C
#define NLEVELS 5
static const uint8_t SIZE[NLEVELS] = { 3, 4, 3, 4, 5 };
static const uint8_t PICMODE[NLEVELS] = { 1, 1, 0, 0, 0 };
static const char *const LABELS[NLEVELS] = { "3 x 3 picture", "4 x 4 picture", "3 x 3 numbers", "4 x 4 numbers", "5 x 5 numbers" };
typedef struct { uint8_t done; uint8_t best[NLEVELS]; uint8_t pic; } save_t;
static save_t sv;
#define T_PIC 176

uint8_t n, tiles[25], blank, picmode, gx0, gy0, pic, quiet;
uint16_t moves;

static void draw_tile(uint8_t pos) {
  uint8_t x = gx0 + (pos % n) * 2, y = gy0 + (pos / n) * 2, v = tiles[pos], t[4];
  if (v == n * n - 1) { ui_fill(x, y, 2, 2, 0); return; }
  if (picmode) {
    /* picture tile v occupies picture column/row; for 3x3 use the centre 48x48 of the 64x64 picture */
    uint8_t off = n == 3 ? 1 : 0, px = v % n + off, py = v / n + off;
    t[0] = T_PIC + py * 16 + px * 2; t[1] = t[0] + 1; t[2] = t[0] + 8; t[3] = t[0] + 9;
  } else {
    uint8_t num = v + 1;
    t[0] = num >= 10 ? GAME_L0 + num / 10 : GAME_LB; t[1] = GAME_R0 + num % 10; t[2] = GAME_BL; t[3] = GAME_BR;
  }
  ui_tiles(x, y, 2, 2, t);
}
static void draw_board(void) { for (uint8_t i = 0; i < n * n; i++) draw_tile(i); }
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "SLIDE PICTURE");
  draw_board();
  ui_text(12, 3, "Moves"); ui_text(12, 6, "Best");
  ui_text(12, 9, "SELECT:"); ui_text(12, 10, "peek");
  ui_text(0, 16, "D-pad slides a tile");
  ui_text(0, 17, "into the gap.");
}
static bool solved(void) { for (uint8_t i = 0; i < n * n; i++) if (tiles[i] != i) return false; return true; }
static bool slide(uint8_t dir) {   /* dir: 0 L 1 R 2 U 3 D = direction the tile moves */
  uint8_t bx = blank % n, by = blank / n, from;
  if (dir == 0) { if (bx == n - 1) return false; from = blank + 1; }
  else if (dir == 1) { if (bx == 0) return false; from = blank - 1; }
  else if (dir == 2) { if (by == n - 1) return false; from = blank + n; }
  else { if (by == 0) return false; from = blank - n; }
  tiles[blank] = tiles[from]; tiles[from] = n * n - 1;
  uint8_t old = blank; blank = from; if (!quiet) { draw_tile(old); draw_tile(blank); }
  return true;
}
static void scramble(void) {
  quiet = 1;
  for (uint8_t i = 0; i < n * n; i++) tiles[i] = i;
  blank = n * n - 1;
  uint8_t last = 255;
  do {
    for (uint8_t k = 0; k < 120 + n * 20; k++) {
      uint8_t d; do { d = rng_range(4); } while (d == (last ^ 1));
      if (slide(d)) last = d;
    }
  } while (solved());
  quiet = 0; moves = 0;
}

static void play(uint8_t level) {
  n = SIZE[level]; picmode = PICMODE[level];
  gx0 = 1; gy0 = 2 + (5 - n);
  if (picmode) { pic = sv.pic % 3; set_bkg_data(T_PIC, 64, PICS[pic]); }
  scramble(); draw_all();
  ui_num(12, 4, moves, 5); ui_num(12, 7, sv.best[level], 5);
  while (1) {
    frame();
    uint8_t d = 255;
    if (keys_rep & J_LEFT) d = 0; else if (keys_rep & J_RIGHT) d = 1; else if (keys_rep & J_UP) d = 2; else if (keys_rep & J_DOWN) d = 3;
    if (d != 255) {
      if (slide(d)) {
        moves++; ui_num(12, 4, moves, 5); sfx_tick();
        if (solved()) {
          sfx_win(); uint8_t b = sv.best[level]; if (!b || moves < b) sv.best[level] = moves > 255 ? 255 : (uint8_t)moves;
          sv.done |= 1 << level; if (picmode) sv.pic = (sv.pic + 1) % 3; save_store(MAGIC, &sv, sizeof sv);
          win_panel("Solved!", "Moves:", "Best:"); ui_num(11, 8, moves, 4); ui_num(11, 9, sv.best[level], 4); win_wait(); return;
        }
      } else sfx_bad();
    } else if (keys_hit & J_SELECT) {
      uint8_t saved[25]; memcpy(saved, tiles, n * n);
      for (uint8_t i = 0; i < n * n; i++) tiles[i] = i;
      draw_board(); wait_frames(70);
      memcpy(tiles, saved, n * n); draw_board();
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "New scramble", "Choose level" };
      uint8_t c = ui_menu("PAUSED", items, 3, 0);
      if (c == 1) scramble(); else if (c == 2) return;
      draw_all(); ui_num(12, 4, moves, 5); ui_num(12, 7, sv.best[level], 5);
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("SLIDE PICTURE", "Slide the tiles", "until the picture", "is whole again.");
  uint8_t level = 0;
  while (1) {
    level = level_select("SLIDE PICTURE", NLEVELS, LABELS, level, sv.done);
    save_store(MAGIC, &sv, sizeof sv);
    play(level);
  }
}
