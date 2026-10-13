/* Pairs: memory. Cards lie face down; turn two over with A. A pair stays, a mismatch turns back
   after a moment (or on your next A). Fewest turns is the record. */
#include "common.h"
#include "tiles.h"
#include <string.h>

#define MAGIC 0x5041
#define NLEVELS 4
static const uint8_t COLS[NLEVELS] = { 3, 4, 5, 6 };
static const uint8_t ROWS[NLEVELS] = { 2, 3, 4, 5 };
static const char *const LABELS[NLEVELS] = { "6 cards", "12 cards", "20 cards", "30 cards" };
typedef struct { uint8_t done; uint8_t best[NLEVELS]; } save_t;
static save_t sv;

uint8_t w, h, n, deck[30], face[30], cx, cy, open1, open2, left, gx0, gy0;
uint16_t turns; uint8_t flip_timer;

static void draw_card(uint8_t i) {
  uint8_t x = gx0 + (i % w) * 2, y = gy0 + (i / w) * 2;
  if (face[i] == 2) ui_fill(x, y, 2, 2, 0);
  else if (face[i] == 1) ui_tile2(x, y, GAME_CIRCLE + deck[i] * 4);
  else ui_tile2(x, y, GAME_BACK);
}
static void draw_all(void) {
  ui_cls(); ui_text(0, 0, "PAIRS");
  for (uint8_t i = 0; i < n; i++) draw_card(i);
  ui_text(0, 16, "Turns:"); ui_text(11, 16, "Left:");
  ui_text(0, 17, "A: turn   START:menu");
}
static void draw_status(void) { ui_num(6, 16, turns, 3); ui_num(16, 16, left, 2); }
static void deal(void) {
  for (uint8_t i = 0; i < n; i++) { deck[i] = (i >> 1); face[i] = 0; }
  for (uint8_t i = n - 1; i > 0; i--) { uint8_t j = rng_range(i + 1); uint8_t t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
  /* shuffle which symbols are used so the small decks vary too */
  uint8_t sym[15]; for (uint8_t i = 0; i < 15; i++) sym[i] = i;
  for (uint8_t i = 14; i > 0; i--) { uint8_t j = rng_range(i + 1); uint8_t t = sym[i]; sym[i] = sym[j]; sym[j] = t; }
  for (uint8_t i = 0; i < n; i++) deck[i] = sym[deck[i]];
  open1 = open2 = 0xFF; left = n >> 1; turns = 0; cx = cy = 0; flip_timer = 0;
}
static void hide_pair(void) { face[open1] = 0; face[open2] = 0; draw_card(open1); draw_card(open2); open1 = open2 = 0xFF; flip_timer = 0; }

static void play(uint8_t level) {
  w = COLS[level]; h = ROWS[level]; n = w * h;
  gx0 = 10 - w; gy0 = 9 - h;
  deal(); draw_all(); draw_status();
  while (1) {
    cursor_show((gx0 + cx * 2) * 8, (gy0 + cy * 2) * 8, 16);
    frame();
    if (flip_timer) { if (--flip_timer == 0) hide_pair(); }
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < w - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < h - 1) cy++;
    else if (keys_hit & J_A) {
      uint8_t i = cy * w + cx;
      if (open2 != 0xFF) hide_pair();
      if (face[i] != 0) { sfx_bad(); continue; }
      face[i] = 1; draw_card(i); sfx_tick();
      if (open1 == 0xFF) open1 = i;
      else {
        open2 = i; turns++; draw_status();
        if (deck[open1] == deck[open2]) {
          face[open1] = face[open2] = 2; draw_card(open1); draw_card(open2); open1 = open2 = 0xFF; left--; draw_status(); sfx_ok();
          if (!left) {
            sfx_win();
            uint8_t b = sv.best[level]; if (!b || turns < b) sv.best[level] = (uint8_t)turns;
            sv.done |= 1 << level; save_store(MAGIC, &sv, sizeof sv);
            win_panel("All pairs found!", "Turns:", "Best:");
            ui_num(11, 8, turns, 4); ui_num(11, 9, sv.best[level], 4); win_wait(); return;
          }
        } else flip_timer = 50;
      }
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "New deal", "Choose size" };
      uint8_t c = ui_menu("PAUSED", items, 3, 0);
      if (c == 1) deal(); else if (c == 2) return;
      draw_all(); draw_status();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("PAIRS", "Turn two cards.", "Same picture: they", "stay. Find them all.");
  uint8_t level = 0;
  while (1) {
    level = level_select("PAIRS", NLEVELS, LABELS, level, sv.done);
    save_store(MAGIC, &sv, sizeof sv);
    play(level);
  }
}
