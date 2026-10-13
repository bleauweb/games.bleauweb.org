/* Light Switch: Lights Out on the Game Boy. Press a light to toggle it and its four neighbours;
   boards are made by pressing random lights on a dark board, so every board can be solved.
   The generating set is kept as the hint and updated by parity as you press. */
#include "common.h"
#include "tiles.h"
#include <string.h>

#define MAGIC 0x4C53
#define NLEVELS 5
static const uint8_t SIZES[NLEVELS] = { 3, 4, 5, 6, 7 };
static const char *const LABELS[NLEVELS] = { "3 x 3", "4 x 4", "5 x 5", "6 x 6", "7 x 7" };

typedef struct { uint8_t done; uint8_t best[NLEVELS]; } save_t;
static save_t sv;

static uint8_t n, on[49], hint[49], cx, cy, hint_on;
static uint16_t moves;
static uint8_t gx0, gy0;

static void draw_cell(uint8_t x, uint8_t y) {
  uint8_t i = y * n + x;
  ui_tile2(gx0 + x * 2, gy0 + y * 2, on[i] ? GAME_ON : GAME_OFF);
  if (hint_on && hint[i]) ui_tile(gx0 + x * 2, gy0 + y * 2, GAME_HINT);
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "LIGHT SWITCH");
  ui_num(14, 0, n, 1); ui_text(15, 0, "x"); ui_num(16, 0, n, 1);
  for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y);
  ui_text(0, 16, "Moves:"); ui_text(11, 16, "B: hint");
  ui_text(0, 17, "A: press  START:menu");
}
static void draw_status(void) { ui_num(6, 16, moves, 4); }
static void toggle(uint8_t x, uint8_t y) {
  on[y * n + x] ^= 1;
  if (x) on[y * n + x - 1] ^= 1;
  if (x < n - 1) on[y * n + x + 1] ^= 1;
  if (y) on[(y - 1) * n + x] ^= 1;
  if (y < n - 1) on[(y + 1) * n + x] ^= 1;
}
static void redraw_around(uint8_t x, uint8_t y) {
  draw_cell(x, y);
  if (x) draw_cell(x - 1, y);
  if (x < n - 1) draw_cell(x + 1, y);
  if (y) draw_cell(x, y - 1);
  if (y < n - 1) draw_cell(x, y + 1);
}
static bool all_off(void) { for (uint8_t i = 0; i < n * n; i++) if (on[i]) return false; return true; }

static void generate(void) {
  uint8_t cells = n * n;
  do {
    memset(on, 0, cells); memset(hint, 0, cells);
    uint8_t presses = n + rng_range(n);
    for (uint8_t k = 0; k < presses; k++) {
      uint8_t i = rng_range(cells);
      hint[i] ^= 1; toggle(i % n, i / n);
    }
  } while (all_off());
  moves = 0; cx = cy = 0; hint_on = 0;
}

static void play(uint8_t level) {
  n = SIZES[level];
  gx0 = 10 - n; gy0 = 8 - n + 1;
  generate();
  draw_all(); draw_status();
  while (1) {
    cursor_show((gx0 + cx * 2) * 8, (gy0 + cy * 2) * 8, 16);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    else if (keys_hit & J_A) {
      toggle(cx, cy); hint[cy * n + cx] ^= 1; moves++;
      redraw_around(cx, cy); draw_status(); sfx_tick();
      if (all_off()) {
        sfx_win();
        uint8_t best = sv.best[level];
        if (!best || moves < best) sv.best[level] = (uint8_t)(moves > 255 ? 255 : moves);
        sv.done |= 1 << level;
        save_store(MAGIC, &sv, sizeof sv);
        win_panel("All lights out!", "Moves:", "Best:");
        ui_num(11, 8, moves, 4); ui_num(11, 9, sv.best[level], 4);
        win_wait();
        return;
      }
    } else if (keys_hit & J_B) {
      hint_on ^= 1; for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y);
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "New board", "Choose size" };
      uint8_t c = ui_menu("PAUSED", items, 3, 0);
      if (c == 1) generate();
      else if (c == 2) return;
      draw_all(); draw_status();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("LIGHT SWITCH", "Press a light and", "its neighbours flip.", "Turn them all off.");
  uint8_t level = 0;
  while (1) {
    level = level_select("LIGHT SWITCH", NLEVELS, LABELS, level, sv.done);
    save_store(MAGIC, &sv, sizeof sv);
    play(level);
  }
}
