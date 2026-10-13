/* Odd One Out: several things share a rule, one breaks it. Pick the odd one; the rule is explained.
   SELECT names the feature to compare. Eight rounds make a set; six right finishes the level. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x4F4F
#define ROUNDS 8
#define PASS 6
static const char *const LABELS[PUZ_LEVELS] = { "One feature", "Any feature", "Distractions", "Two features", "Six items" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t best[PUZ_LEVELS]; } save_t;
static save_t sv;
#define SMALL(c) (GAME_S00 + ((c) & 7) * 3 + (((c) >> 3) & 3))
#define LARGE(c) (GAME_L00 + (((c) & 7) * 3 + (((c) >> 3) & 3)) * 4)

uint8_t nitems, items[6], odd, sel, round_no, right, level, idx;
static uint8_t expl, hint;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  nitems = p[0]; for (uint8_t i = 0; i < 6; i++) items[i] = p[1 + i];
  odd = p[7]; expl = p[8]; hint = p[9]; sel = 0;
}
/* item boxes: 3 per row, each 6 tiles wide and 4 tall, starting at row 3 */
static void box_pos(uint8_t i, uint8_t *x, uint8_t *y) { *x = 1 + (i % 3) * 6; *y = 3 + (i / 3) * 5; }
static void draw_item(uint8_t i) {
  uint8_t x, y; box_pos(i, &x, &y);
  uint8_t c = items[i], count = (c >> 6) + 1, large = (c >> 5) & 1;
  ui_fill(x, y, 6, 4, 0);
  ui_frame(x, y, 6, 4);
  uint8_t w = large ? 2 : 1, total = count * w, sx = x + (6 - total) / 2, sy = y + (large ? 1 : 2);
  for (uint8_t k = 0; k < count; k++) { if (large) ui_tile2(sx + k * 2, sy, LARGE(c)); else ui_tile(sx + k, sy, SMALL(c)); }
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "ODD ONE OUT"); ui_text(14, 0, "Round"); ui_num(19, 0, round_no + 1, 1);
  ui_text(0, 1, "Which one is different?");
  ui_fill(0, 1, 20, 1, 0); ui_text(0, 1, "Which one breaks it?");
  for (uint8_t i = 0; i < nitems; i++) draw_item(i);
  ui_text(0, 14, "Right so far:"); ui_num(14, 14, right, 2);
  ui_text(0, 17, "A: choose  SELECT: hint");
  ui_fill(0, 17, 20, 1, 0); ui_text(0, 17, "A:choose SELECT:hint");
}
static void show_sel(void) { uint8_t x, y; box_pos(sel, &x, &y); cursor_show(x * 8, y * 8, 16); /* corner brackets around a 48x32 box */ 
  uint8_t s = 40; set_sprite_tile(0, SPRITES_CORNER); set_sprite_prop(0, 0); move_sprite(0, x * 8 + 8, y * 8 + 16);
  set_sprite_tile(1, SPRITES_CORNER); set_sprite_prop(1, S_FLIPX); move_sprite(1, x * 8 + 8 + s, y * 8 + 16);
  set_sprite_tile(2, SPRITES_CORNER); set_sprite_prop(2, S_FLIPY); move_sprite(2, x * 8 + 8, y * 8 + 16 + 24);
  set_sprite_tile(3, SPRITES_CORNER); set_sprite_prop(3, S_FLIPX | S_FLIPY); move_sprite(3, x * 8 + 8 + s, y * 8 + 16 + 24);
}
static void explain_screen(bool ok) {
  cursor_hide();
  ui_fill(0, 13, 20, 5, 0);
  ui_text(0, 13, ok ? "Right!" : "Not this time.");
  ui_text(0, 14, EXPL[expl]);
  ui_text(0, 17, "A: next");
  wait_frames(10); wait_key();
}

static void play(void) {
  right = 0;
  for (round_no = 0; round_no < ROUNDS; round_no++) {
    load(); draw_all();
    while (1) {
      show_sel();
      frame();
      if ((keys_rep & J_LEFT) && sel % 3) sel--;
      else if ((keys_rep & J_RIGHT) && sel % 3 < 2 && sel + 1 < nitems) sel++;
      else if ((keys_rep & J_UP) && sel >= 3) sel -= 3;
      else if ((keys_rep & J_DOWN) && sel + 3 < nitems) sel += 3;
      if (keys_hit & J_A) {
        bool ok = sel == odd; if (ok) { right++; sfx_ok(); } else sfx_bad();
        if (!ok) { uint8_t x, y; box_pos(odd, &x, &y); ui_text(x, y + 4 > 13 ? y - 1 : y + 4, "^ this"); }
        explain_screen(ok); idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; break;
      }
      if (keys_hit & J_SELECT) { ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, EXPL[hint]); }
      if (keys_hit & J_START) {
        static const char *const items2[] = { "Continue", "Choose level" };
        if (ui_menu("PAUSED", items2, 2, 0) == 1) return;
        draw_all();
      }
    }
  }
  if (right > sv.best[level]) sv.best[level] = right;
  if (right >= PASS) sv.done |= 1 << level;
  save_store(MAGIC, &sv, sizeof sv);
  sfx_win(); ui_fill(0, 12, 20, 6, 0);
  win_panel(right >= PASS ? "Set complete!" : "Set finished.", "Right:", "of 8. Best:");
  ui_num(11, 8, right, 2); ui_num(16, 9, sv.best[level], 2); win_wait();
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("ODD ONE OUT", "Most of them share", "something. Find the", "one that does not.");
  level = 0;
  while (1) {
    level = level_select("ODD ONE OUT", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
