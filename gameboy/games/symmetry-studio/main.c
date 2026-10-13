/* Symmetry Studio: the dark-edged squares are given; fill the rest so the whole grid has the named
   symmetry. A paints with the current ink, B changes ink (blank is an ink too), SELECT checks. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x5359
static const char *const LABELS[PUZ_LEVELS] = { "Mirror <->  6x6", "Mirror ^v   6x6", "Four-way    6x6", "Half turn   8x8", "Quarter turn 8x8", "Kaleido     7x7", "Quarter turn 10", "Kaleido     11" };
static const char *const RULE[PUZ_LEVELS] = { "Right mirrors left", "Bottom mirrors top", "Mirrored both ways", "Turned half round", "Turned a quarter x4", "Eight-way mirror", "Turned a quarter x4", "Eight-way mirror" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

uint8_t n, k, cell[121], src[121], target[121], cx, cy, gx0, gy0, ink;
static uint8_t level, idx;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = p[0]; k = p[1]; p += 2;
  for (uint8_t y = 0; y < n; y++) { uint16_t m = p[0] | (p[1] << 8); p += 2; for (uint8_t x = 0; x < n; x++) src[y * n + x] = (m >> x) & 1; }
  uint8_t cells = n * n;
  for (uint8_t i = 0; i < cells; i += 2) { target[i] = p[0] & 15; if (i + 1 < cells) target[i + 1] = p[0] >> 4; p++; }
  for (uint8_t i = 0; i < cells; i++) cell[i] = src[i] ? target[i] : 0;
  gx0 = 1 + (12 - n) / 2; gy0 = 2 + (12 - n) / 2; cx = cy = 0; ink = 1;
}
static void draw_cell(uint8_t x, uint8_t y) { uint8_t i = y * n + x; ui_tile(gx0 + x, gy0 + y, (src[i] ? GAME_G0 : GAME_P0) + cell[i]); }
static void draw_palette(void) {
  for (uint8_t c = 0; c <= 6; c++) { ui_tile(16, 4 + c, c <= k ? GAME_P0 + c : 0); ui_tile(17, 4 + c, c == ink ? COMMON_CHECK : 0); }
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "SYMMETRY"); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  ui_text(0, 1, RULE[level]);
  for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y);
  ui_text(15, 2, "ink"); draw_palette();
  ui_text(0, 16, "A:paint B:next ink");
  ui_text(0, 17, "SELECT:check");
}
static void msg(const char *s) { ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, s); }
static bool complete(void) { for (uint8_t i = 0; i < n * n; i++) if (cell[i] != target[i]) return false; return true; }

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((gx0 + cx) * 8, (gy0 + cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    if (keys & J_A) {
      uint8_t i = cy * n + cx;
      uint8_t v = ink;   /* local copy: SDCC 4.5.1 mis-stores `cell[i] = ink` right after comparing cell[i] with the global */
      if (src[i]) { if (keys_hit & J_A) { sfx_bad(); msg("That one is given."); } }
      else if (cell[i] != v) {
        cell[i] = v; draw_cell(cx, cy); sfx_tick();
        if (complete()) {
          sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
          sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
          win_panel("Perfectly balanced!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); return;
        }
      }
    }
    if (keys_hit & J_B) { ink = ink >= k ? 0 : ink + 1; draw_palette(); sfx_tick(); }
    else if (keys_hit & J_SELECT) {
      uint8_t wrong = 0, missing = 0;
      for (uint8_t i = 0; i < n * n; i++) if (cell[i] != target[i]) { if (cell[i] == 0) missing++; else wrong++; }
      ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, "Wrong:"); ui_num(6, 15, wrong, 3); ui_text(10, 15, "Empty:"); ui_num(16, 15, missing, 3);
      if (wrong) sfx_bad(); else sfx_ok();
    } else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Start over", "Next puzzle", "Choose level" };
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
  title_screen("SYMMETRY STUDIO", "Finish the grid so", "it mirrors or turns", "the way it says.");
  level = 0;
  while (1) {
    level = level_select("SYMMETRY STUDIO", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
