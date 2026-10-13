/* Mosaic Numbers (Fill-a-Pix): each number says how many of the nine squares around it (itself
   included) are filled. A fills, B marks empty, SELECT checks. Clues fade once their block is settled.
   Baked puzzles never need more than one clue at a time. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x4D4F
static const char *const LABELS[PUZ_LEVELS] = { "5 x 5", "7 x 7", "Pictures 10x10", "12 x 12" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

uint8_t n, cx, cy, gx0, gy0, clue[144], state[144], cells; /* state 0 unknown 1 filled 2 empty */
uint16_t sol[12];
static uint8_t level, idx;

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = *p++; cells = n * n;
  for (uint8_t i = 0; i < cells; i += 2) { clue[i] = p[0] & 15; clue[i + 1] = p[0] >> 4; p++; }
  for (uint8_t y = 0; y < n; y++) { sol[y] = p[0] | (p[1] << 8); p += 2; }
  memset(state, 0, sizeof state);
  gx0 = (20 - n) / 2; gy0 = 2 + (12 - n) / 2; if (gy0 + n > 15) gy0 = 15 - n;
  cx = cy = 0;
}
static bool settled(uint8_t x, uint8_t y) {
  uint8_t filled = 0, unknown = 0;
  for (int8_t dy = -1; dy <= 1; dy++) for (int8_t dx = -1; dx <= 1; dx++) {
    int8_t xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= (int8_t)n || yy >= (int8_t)n) continue;
    uint8_t s = state[yy * n + xx]; if (s == 1) filled++; else if (s == 0) unknown++;
  }
  return unknown == 0 && filled == clue[y * n + x];
}
static void draw_cell(uint8_t x, uint8_t y) {
  uint8_t i = y * n + x, s = state[i], c = clue[i], t;
  uint8_t base = s == 0 ? GAME_U0 : s == 2 ? GAME_E0 : GAME_F0;
  if (c == 15) t = base + 10;
  else t = base + c + (settled(x, y) ? 11 : 0);
  ui_tile(gx0 + x, gy0 + y, t);
}
static void draw_around(uint8_t x, uint8_t y) {
  for (int8_t dy = -1; dy <= 1; dy++) for (int8_t dx = -1; dx <= 1; dx++) {
    int8_t xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= (int8_t)n || yy >= (int8_t)n) continue;
    draw_cell(xx, yy);
  }
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "MOSAIC NUMBERS"); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) draw_cell(x, y);
  ui_text(0, 16, "A:fill B:empty");
  ui_text(0, 17, "SELECT:check");
}
static void msg(const char *s) { ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, s); }
static bool solved(void) { for (uint8_t y = 0; y < n; y++) { uint16_t f = 0; for (uint8_t x = 0; x < n; x++) if (state[y * n + x] == 1) f |= 1 << x; if (f != sol[y]) return false; } return true; }

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((gx0 + cx) * 8, (gy0 + cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    else if (keys_hit & (J_A | J_B)) {
      uint8_t i = cy * n + cx, want = (keys_hit & J_A) ? 1 : 2;
      state[i] = state[i] == want ? 0 : want; sfx_tick(); draw_around(cx, cy);
      if (solved()) {
        sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
        sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
        win_panel("Mosaic complete!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); return;
      }
    } else if (keys_hit & J_SELECT) {
      uint8_t cnt = 0;
      for (uint8_t y = 0; y < n; y++) for (uint8_t x = 0; x < n; x++) {
        uint8_t s = state[y * n + x]; bool f = (sol[y] >> x) & 1;
        if ((s == 1 && !f) || (s == 2 && f)) { cnt++; state[y * n + x] = 0; draw_around(x, y); }
      }
      if (cnt) { msg("Cleared wrong:"); ui_num(15, 15, cnt, 3); sfx_bad(); } else { msg("Nothing wrong so far."); sfx_ok(); }
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
  title_screen("MOSAIC NUMBERS", "A number counts the", "filled squares in", "the 3x3 around it.");
  level = 0;
  while (1) {
    level = level_select("MOSAIC NUMBERS", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
