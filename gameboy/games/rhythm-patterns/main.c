/* Rhythm Patterns: a step pattern plays with a sweeping marker and clicks; then you mark the
   steps you saw on an empty grid, untimed, and check. SELECT plays it again as often as you like. */
#include "common.h"
#include "tiles.h"
#include <string.h>

#define MAGIC 0x5248
#define NLEVELS 5
static const uint8_t STEPS[NLEVELS] = { 8, 8, 16, 16, 16 };
static const uint8_t ROWS[NLEVELS] = { 1, 2, 1, 2, 3 };
static const uint8_t DENS[NLEVELS] = { 115, 102, 102, 97, 90 }; /* out of 255 */
static const char *const LABELS[NLEVELS] = { "1 line,  8 steps", "2 lines, 8 steps", "1 line, 16 steps", "2 lines,16 steps", "3 lines,16 steps" };
static const char *const ROWNAME[3] = { "Drum", "Clap", "Shake" };
typedef struct { uint8_t done; uint8_t streak[NLEVELS]; } save_t;
static save_t sv;

uint8_t steps, rows, pat[3][16], mark[3][16], cx, cy, gx0;
#define GY0 4
#define ROWH 2
static uint8_t checked;

static void hit(uint8_t row) {
  if (!sound_on) return;
  if (row == 0) { NR41_REG = 0x3A; NR42_REG = 0xF1; NR43_REG = 0x55; NR44_REG = 0xC0; }
  else if (row == 1) { NR41_REG = 0x3C; NR42_REG = 0xB1; NR43_REG = 0x24; NR44_REG = 0xC0; }
  else { NR41_REG = 0x3E; NR42_REG = 0x61; NR43_REG = 0x05; NR44_REG = 0xC0; }
}
static void draw_cell(uint8_t r, uint8_t s, uint8_t tile) { ui_tile(gx0 + s, GY0 + r * ROWH, tile); }
static uint8_t base_tile(uint8_t r, uint8_t s) {
  if (checked) {
    if (mark[r][s] && !pat[r][s]) return GAME_STEP_X;
    if (!mark[r][s] && pat[r][s]) return GAME_STEP_MISS;
  }
  if (mark[r][s]) return GAME_STEP_ON;
  return (s & 3) ? GAME_STEP : GAME_STEP_BEAT;
}
static void draw_grid(void) { for (uint8_t r = 0; r < rows; r++) for (uint8_t s = 0; s < steps; s++) draw_cell(r, s, base_tile(r, s)); }
static void draw_all(void) {
  ui_cls(); ui_text(0, 0, "RHYTHM PATTERNS");
  for (uint8_t r = 0; r < rows; r++) ui_text(gx0 - 0, GY0 + r * ROWH - 1, ROWNAME[r]);
  draw_grid();
  ui_text(0, 11, "SELECT: play it");
  ui_text(0, 12, "A: mark a step");
  ui_text(0, 13, "B: check");
  ui_text(0, 15, "Marks every 4th step");
  ui_text(0, 16, "are the beats.");
  ui_text(0, 17, "START: menu");
}
static void generate(void) {
  for (uint8_t r = 0; r < rows; r++) {
    uint8_t count;
    do {
      count = 0;
      for (uint8_t s = 0; s < steps; s++) { pat[r][s] = (rng_next() & 0xFF) < DENS[r == 0 ? 0 : (r)] + (r == 0 ? 20 : 0) ? 1 : 0; count += pat[r][s]; }
      if (r == 0) pat[r][0] = 1, count++;
    } while (count < 2 || count > steps - 2);
  }
  memset(mark, 0, sizeof mark); checked = 0; cx = cy = 0;
}
static void playback(void) {
  cursor_hide();
  for (uint8_t s = 0; s < steps; s++) {
    marker_show(0, (gx0 + s) * 8, (GY0 - 1) * 8 + 4, SPRITES_DOT);
    for (uint8_t r = 0; r < rows; r++) if (pat[r][s]) { draw_cell(r, s, GAME_STEP_LIT); hit(r); }
    wait_frames(4);
    for (uint8_t r = 0; r < rows; r++) draw_cell(r, s, base_tile(r, s));
    wait_frames(steps == 8 ? 8 : 4);
  }
  marker_hide(0);
}
static bool matches(void) { for (uint8_t r = 0; r < rows; r++) for (uint8_t s = 0; s < steps; s++) if (pat[r][s] != mark[r][s]) return false; return true; }

static void play(uint8_t level) {
  steps = STEPS[level]; rows = ROWS[level]; gx0 = steps == 8 ? 6 : 2;
  generate(); draw_all(); wait_frames(20); playback();
  while (1) {
    cursor_show((gx0 + cx) * 8, (GY0 + cy * ROWH) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < steps - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < rows - 1) cy++;
    else if (keys_hit & J_A) { mark[cy][cx] ^= 1; checked = 0; draw_grid(); if (mark[cy][cx]) hit(cy); else sfx_tick(); }
    else if (keys_hit & J_SELECT) { playback(); }
    else if (keys_hit & J_B) {
      checked = 1; draw_grid();
      if (matches()) {
        sfx_win(); sv.done |= 1 << level; if (sv.streak[level] < 255) sv.streak[level]++;
        save_store(MAGIC, &sv, sizeof sv);
        win_panel("That's the pattern!", "Solved so far:", "");
        ui_num(14, 8, sv.streak[level], 4); win_wait(); return;
      }
      sfx_bad(); ui_fill(0, 14, 20, 1, 0); ui_text(0, 14, "X extra  : missing");
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "New pattern", "Choose level" };
      uint8_t c = ui_menu("PAUSED", items, 3, 0);
      if (c == 1) { generate(); draw_all(); wait_frames(20); playback(); continue; }
      if (c == 2) return;
      draw_all();
    }
  }
}

void main(void) {
  ui_init(); sfx_init();
  if (!save_load(MAGIC, &sv, sizeof sv)) memset(&sv, 0, sizeof sv);
  set_bkg_data(GAME_FIRST, GAME_COUNT, game_tiles);
  title_screen("RHYTHM PATTERNS", "Watch and listen,", "then mark the steps", "you saw. No timer.");
  uint8_t level = 0;
  while (1) {
    level = level_select("RHYTHM PATTERNS", NLEVELS, LABELS, level, sv.done);
    save_store(MAGIC, &sv, sizeof sv);
    play(level);
  }
}
