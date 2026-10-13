/* Sequence Lab: what comes next? Number rules and shape rules, four options, and the rule is
   explained after every answer. Eight rounds make a set; six right finishes the level. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x5351
#define ROUNDS 8
#define PASS 6
static const char *const LABELS[PUZ_LEVELS] = { "Steady steps", "One thing changes", "Bigger jumps", "Two things change", "Famous sequences", "Three things change", "Everything" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t best[PUZ_LEVELS]; } save_t;
static save_t sv;
#define SMALL(c) (GAME_S00 + ((c) & 7) * 3 + (((c) >> 3) & 3))
#define LARGE(c) (GAME_L00 + (((c) & 7) * 3 + (((c) >> 3) & 3)) * 4)

uint8_t kind, terms, answer, sel, round_no, right, level, idx;
uint16_t shown[6], opts[4];
static uint8_t expl;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  kind = p[0]; terms = p[1]; p += 2;
  for (uint8_t i = 0; i < 6; i++) { shown[i] = p[0] | (p[1] << 8); p += 2; }
  for (uint8_t i = 0; i < 4; i++) { opts[i] = p[0] | (p[1] << 8); p += 2; }
  answer = p[0]; expl = p[1]; sel = 0;
}
static void draw_item(uint8_t x, uint8_t y, uint16_t c) {   /* 16px slot at tile x,y */
  ui_fill(x, y, 2, 2, 0);
  if ((c >> 5) & 1) ui_tile2(x, y, LARGE(c)); else ui_tile(x, y + 1, SMALL(c));
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "SEQUENCE LAB"); ui_text(14, 0, "Round"); ui_num(19, 0, round_no + 1, 1);
  ui_text(0, 2, "What comes next?");
  if (kind == 0) {
    uint8_t x = 0, y = 4;
    for (uint8_t i = 0; i < terms; i++) {
      uint16_t v = shown[i]; uint8_t w = v >= 1000 ? 4 : v >= 100 ? 3 : v >= 10 ? 2 : 1;
      if (x + w + 2 > 20) { x = 0; y++; }
      ui_num(x, y, v, w); x += w; ui_text(x, y, ","); x += 2;
    }
    if (x + 1 > 20) { x = 0; y++; }
    ui_text(x, y, "?");
    for (uint8_t i = 0; i < 4; i++) ui_num(4, 8 + i, opts[i], 5);
  } else {
    uint8_t x0 = (20 - terms * 3 + 1) / 2;
    for (uint8_t i = 0; i < terms; i++) draw_item(x0 + i * 3, 4, shown[i]);
    ui_text(x0 + terms * 3, 5, "?");
    for (uint8_t i = 0; i < 4; i++) draw_item(3 + i * 4, 9, opts[i]);
  }
  ui_text(0, 14, "Right so far:"); ui_num(14, 14, right, 2);
  ui_text(0, 17, kind == 0 ? "Up/Down then A" : "Left/Right then A");
}
static void show_sel(void) {
  if (kind == 0) { ui_fill(2, 8, 1, 4, 0); ui_text(2, 8 + sel, ">"); cursor_hide(); }
  else cursor_show((3 + sel * 4) * 8, 9 * 8, 16);
}
static void explain_screen(bool ok) {
  cursor_hide();
  ui_fill(0, 14, 20, 4, 0);
  ui_text(0, 13, ok ? "Right!" : "No. It was:");
  if (!ok) { if (kind == 0) ui_num(12, 13, opts[answer], 4); else draw_item(13, 12, opts[answer]); }
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
      if (kind == 0) { if ((keys_rep & J_UP) && sel) sel--; else if ((keys_rep & J_DOWN) && sel < 3) sel++; }
      else { if ((keys_rep & J_LEFT) && sel) sel--; else if ((keys_rep & J_RIGHT) && sel < 3) sel++; }
      if (keys_hit & J_A) {
        bool ok = sel == answer; if (ok) { right++; sfx_ok(); } else sfx_bad();
        explain_screen(ok); idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; break;
      }
      if (keys_hit & J_START) {
        static const char *const items[] = { "Continue", "Choose level" };
        if (ui_menu("PAUSED", items, 2, 0) == 1) return;
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
  title_screen("SEQUENCE LAB", "Spot the rule and", "pick what comes", "next. Rules explained.");
  level = 0;
  while (1) {
    level = level_select("SEQUENCE LAB", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
