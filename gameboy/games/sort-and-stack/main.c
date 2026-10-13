/* Sort and Stack: pick up an item with A, choose a bin with LEFT/RIGHT, drop it with A. Bins show their
   rule as pictures; when they only show an example, work the rule out. Two misses earn a hint, and
   the rule is spelled out at the end. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x5353
static const char *const LABELS[PUZ_LEVELS] = { "By fill", "By shape", "Two things at once", "Find the rule", "Is it, or not?", "Find two features", "Any rule" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;
#define SMALL(c) (GAME_S00 + ((c) & 7) * 3 + (((c) >> 3) & 3))
#define LARGE(c) (GAME_L00 + (((c) & 7) * 3 + (((c) >> 3) & 3)) * 4)

uint8_t nitems, items[14], bin_of[14], placed[14], nbins, labelled, examples[4], icon1[4], icon2[4], notf[4], incount[4];
uint8_t cx, cy, picked, bsel, misses, left, level, idx;
static uint8_t expl, hint;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  nitems = p[0]; p++;
  for (uint8_t i = 0; i < 14; i++) items[i] = p[i]; p += 14;
  for (uint8_t i = 0; i < 14; i++) bin_of[i] = p[i]; p += 14;
  nbins = p[0]; labelled = p[1]; p += 2;
  for (uint8_t i = 0; i < 4; i++) examples[i] = p[i]; p += 4;
  for (uint8_t i = 0; i < 4; i++) { icon1[i] = p[0]; icon2[i] = p[1]; notf[i] = p[2]; p += 3; }
  expl = p[0]; hint = p[1];
  memset(placed, 0, sizeof placed); memset(incount, 0, sizeof incount);
  left = nitems; cx = cy = 0; picked = 0xFF; bsel = 0; misses = 0;
  if (!labelled) for (uint8_t i = 0; i < 4; i++) if (examples[i] != 255 && examples[i] < nitems) { placed[examples[i]] = 1; incount[bin_of[examples[i]]]++; left--; }
}
static void draw_item_at(uint8_t x, uint8_t y, uint8_t c) { ui_fill(x, y, 2, 2, 0); if ((c >> 5) & 1) ui_tile2(x, y, LARGE(c)); else ui_tile(x, y + 1, SMALL(c)); }
static void draw_slot(uint8_t i) {
  uint8_t x = 1 + (i % 4) * 2, y = 2 + (i / 4) * 2;
  if (placed[i]) ui_fill(x, y, 2, 2, 0); else draw_item_at(x, y, items[i]);
}
static void draw_bin(uint8_t b) {
  uint8_t x = b * 5;
  ui_fill(x, 11, 5, 6, 0); ui_frame(x, 11, 5, 6);
  if (labelled) {
    draw_item_at(x + (icon2[b] == 255 ? 1 : 0), 12, icon1[b]);
    if (icon2[b] != 255) draw_item_at(x + 2, 12, icon2[b]);
    if (notf[b]) ui_tile(x + 3, 12, COMMON_BOX_X);
  } else {
    ui_text(x + 2, 12, "?");
    for (uint8_t i = 0; i < 4; i++) if (examples[i] != 255 && bin_of[examples[i]] == b) draw_item_at(x + 1, 13, items[examples[i]]);
  }
  ui_num(x + 1, 15, incount[b], 2);
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "SORT AND STACK");
  for (uint8_t i = 0; i < nitems; i++) draw_slot(i);
  ui_text(11, 3, "Left:"); ui_num(16, 3, left, 2);
  ui_text(11, 5, "A: pick"); ui_text(11, 6, "up, then"); ui_text(11, 7, "A: drop");
  for (uint8_t b = 0; b < nbins; b++) draw_bin(b);
  ui_text(0, 17, "B: put it back");
}
static void msg(const char *s) { ui_fill(0, 10, 20, 1, 0); ui_text(0, 10, s); }

static void play(void) {
  load(); draw_all();
  while (1) {
    if (picked == 0xFF) { cursor_show((1 + cx * 2) * 8, (2 + cy * 2) * 8, 16); marker_hide(0); }
    else { cursor_hide(); marker_show(0, bsel * 40 + 16, 11 * 8 - 2, SPRITES_HAND); }
    frame();
    if (picked == 0xFF) {
      if ((keys_rep & J_LEFT) && cx) cx--;
      else if ((keys_rep & J_RIGHT) && cx < 3 && cy * 4 + cx + 1 < nitems) cx++;
      else if ((keys_rep & J_UP) && cy) cy--;
      else if ((keys_rep & J_DOWN) && (cy + 1) * 4 + cx < nitems) cy++;
      else if (keys_hit & J_A) { uint8_t i = cy * 4 + cx; if (!placed[i]) { picked = i; marker_show(1, (1 + cx * 2) * 8 + 4, (2 + cy * 2) * 8 + 4, SPRITES_DOT); sfx_tick(); msg("Pick a bin, A: drop"); } else sfx_bad(); }
    } else {
      if ((keys_rep & J_LEFT) && bsel) bsel--;
      else if ((keys_rep & J_RIGHT) && bsel < nbins - 1) bsel++;
      else if (keys_hit & J_B) { picked = 0xFF; marker_hide(1); msg(""); }
      else if (keys_hit & J_A) {
        if (bin_of[picked] == bsel) {
          placed[picked] = 1; incount[bsel]++; left--; draw_slot(picked); draw_bin(bsel); ui_num(16, 3, left, 2);
          marker_hide(1); picked = 0xFF; sfx_ok(); msg("");
          if (!left) {
            sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
            sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
            cursor_hide(); marker_hide(0);
            ui_fill(0, 11, 20, 7, 0); ui_text(0, 11, "All sorted! The rule:"); ui_text(0, 12, EXPL[expl]); ui_text(0, 16, "A: continue");
            wait_frames(10); wait_key(); return;
          }
        } else {
          misses++; sfx_bad();
          msg(misses >= 2 ? EXPL[hint] : "Not that bin.");
        }
      }
    }
    if (keys_hit & J_START) {
      static const char *const items2[] = { "Continue", "Start over", "Next puzzle", "Choose level" };
      uint8_t c = ui_menu("PAUSED", items2, 4, 0);
      if (c == 1) load(); else if (c == 2) { idx = (idx + 1) % PUZ_PER_LEVEL; sv.next[level] = idx; load(); } else if (c == 3) { marker_hide(0); marker_hide(1); return; }
      draw_all();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("SORT AND STACK", "Put each thing in", "the bin where it", "belongs.");
  level = 0;
  while (1) {
    marker_hide(0); marker_hide(1);
    level = level_select("SORT AND STACK", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
