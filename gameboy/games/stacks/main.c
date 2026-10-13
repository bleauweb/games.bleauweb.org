/* Stacks: Tower of Hanoi, 3 to 6 discs. LEFT/RIGHT choose a peg, A lifts or drops, B undoes,
   SELECT shows the next good move. Moves are counted against the fewest possible. */
#include "common.h"
#include "tiles.h"
#include <string.h>

#define MAGIC 0x5354
#define NLEVELS 4
static const uint8_t DISCS[NLEVELS] = { 3, 4, 5, 6 };
static const char *const LABELS[NLEVELS] = { "3 discs   (7 moves)", "4 discs  (15 moves)", "5 discs  (31 moves)", "6 discs  (63 moves)" };
typedef struct { uint8_t done; uint8_t best[NLEVELS]; } save_t;
static save_t sv;

#define TOP 10               /* row of the base */
static const uint8_t PEGX[3] = { 3, 10, 16 };
uint8_t nd, pegs[3][6], cnt[3], sel, carried, from, hist[80][2], nh;
static uint16_t moves;

static void draw_disc(uint8_t x0, uint8_t y, uint8_t w) {
  uint8_t x = x0 - (w >> 1);
  if (w == 1) { ui_tile(x, y, GAME_DISC_1); return; }
  ui_tile(x, y, GAME_DISC_L);
  for (uint8_t i = 1; i < w - 1; i++) ui_tile(x + i, y, GAME_DISC_M);
  ui_tile(x + w - 1, y, GAME_DISC_R);
}
static void draw_peg(uint8_t p) {
  uint8_t x = PEGX[p];
  ui_fill(x - 3, 2, 7, 8, 0);
  for (uint8_t y = 3; y < TOP; y++) ui_tile(x, y, GAME_PEG);
  for (uint8_t i = 0; i < cnt[p]; i++) draw_disc(x, TOP - 1 - i, pegs[p][i]);
  if (carried && sel == p) draw_disc(x, 2, carried);
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "STACKS");
  for (uint8_t x = 0; x < 20; x++) ui_tile(x, TOP, GAME_BASE);
  for (uint8_t p = 0; p < 3; p++) draw_peg(p);
  ui_text(0, 12, "Moves:"); ui_text(10, 12, "Goal:");
  ui_text(0, 14, "Move every disc to");
  ui_text(0, 15, "the right peg. Never");
  ui_text(0, 16, "put a disc on a");
  ui_text(0, 17, "smaller one. SELECT:hint");
  ui_fill(0, 17, 20, 1, 0); ui_text(0, 17, "smaller one.");
}
static void draw_status(void) {
  ui_num(6, 12, moves, 3);
  ui_num(15, 12, ((uint16_t)1 << nd) - 1, 3);
  ui_fill(0, 13, 20, 1, 0);
  if (carried) ui_text(0, 13, "A: put down   B: back");
  else ui_text(0, 13, "A: lift  SELECT: hint");
}
static void hint(void) {
  /* classic: the next move in the optimal solution from any position (same as the web game) */
  uint8_t target = 2, best_from = 0, best_to = 0;
  bool found = false;
  /* find largest disc not yet in place on target, recursively decide its sub-target */
  uint8_t d = nd;
  uint8_t src = 0;
  while (d) {
    /* locate disc d */
    uint8_t p = 0, i = 0;
    for (p = 0; p < 3; p++) { for (i = 0; i < cnt[p]; i++) if (pegs[p][i] == d) break; if (i < cnt[p]) break; }
    if (p == target) { d--; continue; }
    /* disc d must move from p to target; everything smaller must go to the third peg first */
    src = p;
    uint8_t other = 3 - p - target;
    /* can it move now? top of src is d and top of target bigger than d or empty */
    bool top_src = cnt[p] && pegs[p][cnt[p] - 1] == d;
    bool top_ok = cnt[target] == 0 || pegs[target][cnt[target] - 1] > d;
    if (top_src && top_ok) { best_from = p; best_to = target; found = true; break; }
    target = other; d--;
  }
  ui_fill(0, 13, 20, 1, 0);
  if (!found) { ui_text(0, 13, "Already solved!"); return; }
  ui_text(0, 13, "Try: peg"); ui_num(8, 13, best_from + 1, 2); ui_text(11, 13, "to peg"); ui_num(17, 13, best_to + 1, 2);
  (void)src;
}
static bool solved(void) { return cnt[2] == nd; }

static void play(uint8_t level) {
  nd = DISCS[level];
  for (uint8_t i = 0; i < nd; i++) pegs[0][i] = nd - i;
  cnt[0] = nd; cnt[1] = cnt[2] = 0; sel = 0; carried = 0; moves = 0; nh = 0;
  draw_all(); draw_status();
  while (1) {
    marker_show(0, PEGX[sel] * 8, 8, SPRITES_HAND);
    frame();
    if ((keys_rep & J_LEFT) && sel) { uint8_t o = sel; sel--; if (carried) { draw_peg(o); draw_peg(sel); } }
    else if ((keys_rep & J_RIGHT) && sel < 2) { uint8_t o = sel; sel++; if (carried) { draw_peg(o); draw_peg(sel); } }
    else if (keys_hit & J_A) {
      if (!carried) {
        if (cnt[sel]) { carried = pegs[sel][--cnt[sel]]; from = sel; draw_peg(sel); sfx_tick(); draw_status(); }
        else sfx_bad();
      } else {
        if (cnt[sel] && pegs[sel][cnt[sel] - 1] < carried) { sfx_bad(); ui_fill(0, 13, 20, 1, 0); ui_text(0, 13, "That disc is bigger."); }
        else {
          pegs[sel][cnt[sel]++] = carried;
          if (sel != from) { moves++; if (nh < 80) { hist[nh][0] = from; hist[nh][1] = sel; nh++; } sfx_ok(); }
          carried = 0; draw_peg(sel); draw_status();
          if (solved()) {
            sfx_win();
            uint8_t b = sv.best[level];
            if (!b || moves < b) sv.best[level] = (uint8_t)moves;
            sv.done |= 1 << level; save_store(MAGIC, &sv, sizeof sv);
            win_panel("Stacked!", "Moves:", "Best:");
            ui_num(11, 8, moves, 4); ui_num(11, 9, sv.best[level], 4);
            win_wait(); return;
          }
        }
      }
    } else if (keys_hit & J_B) {
      if (carried) { pegs[from][cnt[from]++] = carried; carried = 0; draw_peg(from); draw_peg(sel); draw_status(); }
      else if (nh) {
        nh--; uint8_t f = hist[nh][0], t = hist[nh][1];
        pegs[f][cnt[f]++] = pegs[t][--cnt[t]]; moves++; draw_peg(f); draw_peg(t); draw_status(); sfx_tick();
      }
    } else if (keys_hit & J_SELECT) { if (!carried) hint(); }
    else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Start again", "Choose discs" };
      uint8_t c = ui_menu("PAUSED", items, 3, 0);
      if (c == 1) { marker_hide(0); return play(level); }
      if (c == 2) { marker_hide(0); return; }
      draw_all(); draw_status();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("STACKS", "Move the tower to", "the right-hand peg,", "one disc at a time.");
  uint8_t level = 0;
  while (1) {
    marker_hide(0);
    level = level_select("STACKS", NLEVELS, LABELS, level, sv.done);
    save_store(MAGIC, &sv, sizeof sv);
    play(level);
  }
}
