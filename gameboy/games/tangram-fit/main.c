/* Tangram Fit: fill the outline exactly with the pieces. SELECT picks the next piece, B turns it
   (and flips it over), A sets it down so that it covers the square under the cursor, A on a placed
   piece lifts it again. The silhouettes were built from the pieces, so they always fit. */
#include "common.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x5446
static const char *const LABELS[PUZ_LEVELS] = { "Three pieces", "Four pieces", "Five pentominoes", "Six pieces", "Eight pieces" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;
static const uint8_t FILLS[8] = { COMMON_SOLID3, COMMON_SOLID1, COMMON_PAT_DIAG, COMMON_PAT_CHECK, COMMON_SOLID2, COMMON_PAT_DOTS, COMMON_PAT_HSTRIPE, COMMON_PAT_VSTRIPE };

uint8_t w, h, npc, shape[8], sil[100], owner[100], placed[8], cx, cy, cur, orient_n, ocount;
int8_t ocells[8][5][2];  /* orientations of the current piece, normalised */
uint8_t ncell;
static uint8_t level, idx;
#define GX0 1
#define GY0 2

static void normalise(int8_t c[5][2], uint8_t k) {
  int8_t mx = 99, my = 99;
  for (uint8_t i = 0; i < k; i++) { if (c[i][0] < mx) mx = c[i][0]; if (c[i][1] < my) my = c[i][1]; }
  for (uint8_t i = 0; i < k; i++) { c[i][0] -= mx; c[i][1] -= my; }
}
static bool same(int8_t a[5][2], int8_t b[5][2], uint8_t k) {
  for (uint8_t i = 0; i < k; i++) { bool f = false; for (uint8_t j = 0; j < k; j++) if (a[i][0] == b[j][0] && a[i][1] == b[j][1]) f = true; if (!f) return false; }
  return true;
}
static void build_orients(void) {
  const uint8_t *s = SHAPES + shape[cur] * 10;
  int8_t c[5][2]; ncell = 0;
  for (uint8_t i = 0; i < 5; i++) if (s[i * 2] != 0xFF) { c[ncell][0] = s[i * 2]; c[ncell][1] = s[i * 2 + 1]; ncell++; }
  ocount = 0;
  for (uint8_t f = 0; f < 2; f++) {
    for (uint8_t r = 0; r < 4; r++) {
      int8_t t[5][2];
      for (uint8_t i = 0; i < ncell; i++) { t[i][0] = c[i][0]; t[i][1] = c[i][1]; }
      if (f) for (uint8_t i = 0; i < ncell; i++) t[i][0] = -t[i][0];
      for (uint8_t q = 0; q < r; q++) for (uint8_t i = 0; i < ncell; i++) { int8_t x = t[i][0]; t[i][0] = -t[i][1]; t[i][1] = x; }
      normalise(t, ncell);
      bool dup = false; for (uint8_t o = 0; o < ocount; o++) if (same(ocells[o], t, ncell)) dup = true;
      if (!dup) { for (uint8_t i = 0; i < ncell; i++) { ocells[ocount][i][0] = t[i][0]; ocells[ocount][i][1] = t[i][1]; } ocount++; }
    }
  }
  orient_n = 0;
}
static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  w = p[0]; h = p[1]; p += 2;
  for (uint8_t y = 0; y < 10; y++) { uint16_t m = p[0] | (p[1] << 8); p += 2; for (uint8_t x = 0; x < 10; x++) sil[y * 10 + x] = (m >> x) & 1; }
  npc = *p++; for (uint8_t i = 0; i < npc; i++) { shape[i] = p[i]; placed[i] = 0; }
  memset(owner, 0xFF, sizeof owner); cx = cy = 0; cur = 0; build_orients();
}
static void draw_cell(uint8_t x, uint8_t y) {
  uint8_t i = y * 10 + x, t = 0;
  if (owner[i] != 0xFF) t = FILLS[owner[i]]; else if (sil[i]) t = COMMON_BOX;
  ui_tile(GX0 + x, GY0 + y, t);
}
static void draw_preview(void) {
  ui_fill(13, 4, 6, 6, 0);
  for (uint8_t i = 0; i < ncell; i++) ui_tile(13 + ocells[orient_n][i][0], 4 + ocells[orient_n][i][1], FILLS[cur]);
  ui_fill(13, 10, 7, 1, 0); ui_text(13, 10, "Piece"); ui_num(18, 10, cur + 1, 1);
  ui_text(13, 11, placed[cur] ? "placed" : "      ");
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "TANGRAM FIT"); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  for (uint8_t y = 0; y < 10; y++) for (uint8_t x = 0; x < 10; x++) draw_cell(x, y);
  ui_text(13, 2, "Next:");
  draw_preview();
  ui_text(0, 13, "A:place/lift B:turn");
  ui_text(0, 14, "SELECT:next piece");
  ui_text(0, 16, "Fill the outline");
  ui_text(0, 17, "exactly.");
}
static void msg(const char *s) { ui_fill(0, 15, 20, 1, 0); ui_text(0, 15, s); }
static bool try_place(uint8_t ax, uint8_t ay) {   /* place current piece with cell k at anchor */
  for (uint8_t k = 0; k < ncell; k++) {
    int8_t ox = (int8_t)ax - ocells[orient_n][k][0], oy = (int8_t)ay - ocells[orient_n][k][1];
    bool ok = true;
    for (uint8_t i = 0; i < ncell && ok; i++) {
      int8_t x = ox + ocells[orient_n][i][0], y = oy + ocells[orient_n][i][1];
      if (x < 0 || y < 0 || x >= 10 || y >= 10 || !sil[y * 10 + x] || owner[y * 10 + x] != 0xFF) ok = false;
    }
    if (ok) {
      for (uint8_t i = 0; i < ncell; i++) { uint8_t x = ox + ocells[orient_n][i][0], y = oy + ocells[orient_n][i][1]; owner[y * 10 + x] = cur; draw_cell(x, y); }
      placed[cur] = 1; return true;
    }
  }
  return false;
}
static void lift(uint8_t piece) {
  for (uint8_t i = 0; i < 100; i++) if (owner[i] == piece) { owner[i] = 0xFF; draw_cell(i % 10, i / 10); }
  placed[piece] = 0;
}
static bool complete(void) { for (uint8_t i = 0; i < 100; i++) if (sil[i] && owner[i] == 0xFF) return false; return true; }
static void next_piece(void) {
  uint8_t start = cur;
  do { cur = (cur + 1) % npc; } while (placed[cur] && cur != start);
  build_orients(); draw_preview();
}

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((GX0 + cx) * 8, (GY0 + cy) * 8, 8);
    frame();
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < 9) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < 9) cy++;
    else if (keys_hit & J_A) {
      uint8_t i = cy * 10 + cx;
      if (owner[i] != 0xFF) { cur = owner[i]; lift(cur); build_orients(); draw_preview(); sfx_tick(); msg("Lifted."); }
      else if (!sil[i]) { sfx_bad(); msg("Outside the outline."); }
      else if (placed[cur]) { sfx_bad(); msg("That piece is placed."); }
      else if (try_place(cx, cy)) {
        sfx_ok(); msg("");
        if (complete()) {
          sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++;
          sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv);
          win_panel("A perfect fit!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); return;
        }
        next_piece();
      } else { sfx_bad(); msg("Does not fit there."); }
    } else if (keys_hit & J_B) { orient_n = (orient_n + 1) % ocount; draw_preview(); sfx_tick(); }
    else if (keys_hit & J_SELECT) { next_piece(); sfx_tick(); }
    else if (keys_hit & J_START) {
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
  title_screen("TANGRAM FIT", "Fill the outline", "exactly with the", "pieces. They do fit.");
  level = 0;
  while (1) {
    level = level_select("TANGRAM FIT", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
