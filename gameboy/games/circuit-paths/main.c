/* Circuit Paths (Flow): join each pair of matching numbers with a path, no crossing, every square used.
   Stand on a number and press A to start drawing; move to extend, move back to shorten. Drawing over
   another path trims it. A or B stops drawing. Every baked puzzle has a full solution. */
#include "common.h"
#include "tiles.h"
#include "puzzles.h"
#include <string.h>

#define MAGIC 0x4350
static const char *const LABELS[PUZ_LEVELS] = { "5 x 5", "6 x 6", "7 x 7", "8 x 8", "9 x 9" };
typedef struct { uint8_t done; uint8_t next[PUZ_LEVELS]; uint8_t solved[PUZ_LEVELS]; } save_t;
static save_t sv;

#define MAXP 10
uint8_t n, np, ends[MAXP][2], owner[81], paths[MAXP][82], plen[MAXP], cx, cy, gx0, gy0, drawing; /* drawing = pair+1 or 0 */
static uint8_t level, idx;
#define OWNER_NONE 0xFF

static void load(void) {
  const uint8_t *p = PUZ + ((uint16_t)level * PUZ_PER_LEVEL + idx) * PUZ_STRIDE;
  n = p[0]; np = p[1]; p += 2;
  for (uint8_t i = 0; i < np; i++) { ends[i][0] = p[1] * n + p[0]; ends[i][1] = p[3] * n + p[2]; p += 4; plen[i] = 0; }
  memset(owner, OWNER_NONE, sizeof owner);
  gx0 = 1 + (9 - n) / 2; gy0 = 2 + (9 - n) / 2; cx = cy = 0; drawing = 0;
}
static bool is_end(uint8_t c, uint8_t *pair) { for (uint8_t i = 0; i < np; i++) if (ends[i][0] == c || ends[i][1] == c) { *pair = i; return true; } return false; }
static uint8_t conn_mask(uint8_t pair, uint8_t pos) {
  uint8_t m = 0, c = paths[pair][pos];
  if (pos > 0) { uint8_t q = paths[pair][pos - 1]; if (q == c - 1) m |= 1; else if (q == c + 1) m |= 2; else if (q == c - n) m |= 4; else m |= 8; }
  if (pos + 1 < plen[pair]) { uint8_t q = paths[pair][pos + 1]; if (q == c - 1) m |= 1; else if (q == c + 1) m |= 2; else if (q == c - n) m |= 4; else m |= 8; }
  return m;
}
static void draw_cell(uint8_t c) {
  uint8_t pair, x = c % n, y = c / n;
  if (is_end(c, &pair)) { ui_tile(gx0 + x, gy0 + y, GAME_E1 + pair); return; }
  if (owner[c] == OWNER_NONE) { ui_tile(gx0 + x, gy0 + y, GAME_L0); return; }
  uint8_t p = owner[c], pos = 0; while (paths[p][pos] != c) pos++;
  ui_tile(gx0 + x, gy0 + y, GAME_L0 + conn_mask(p, pos));
}
static void status(void) {
  ui_fill(0, 15, 20, 1, 0);
  if (drawing) { ui_text(0, 15, "Drawing path"); ui_num(13, 15, drawing, 2); ui_text(16, 15, "B:stop"); }
  else ui_text(0, 15, "A on a number: draw");
}
static void draw_all(void) {
  ui_cls();
  ui_text(0, 0, "CIRCUIT PATHS"); ui_num(16, 0, idx + 1, 1); ui_text(17, 0, "/"); ui_num(18, 0, PUZ_PER_LEVEL, 1);
  for (uint8_t c = 0; c < n * n; c++) draw_cell(c);
  ui_text(13, 3, "Join"); ui_text(13, 4, "each"); ui_text(13, 5, "pair.");
  ui_text(13, 7, "Fill"); ui_text(13, 8, "every"); ui_text(13, 9, "square.");
  status();
  ui_text(0, 16, "A:start/stop B:stop");
  ui_text(0, 17, "START:menu");
}
static void trim(uint8_t pair, uint8_t from_pos) {   /* remove cells from_pos.. of a path */
  for (uint8_t i = from_pos; i < plen[pair]; i++) { uint8_t c = paths[pair][i]; owner[c] = OWNER_NONE; }
  uint8_t old = plen[pair]; plen[pair] = from_pos;
  for (uint8_t i = from_pos ? from_pos - 1 : 0; i < old; i++) draw_cell(paths[pair][i]);
}
static bool complete(void) {
  for (uint8_t c = 0; c < n * n; c++) if (owner[c] == OWNER_NONE) return false;
  for (uint8_t i = 0; i < np; i++) { if (plen[i] < 2) return false; uint8_t a = paths[i][0], b = paths[i][plen[i] - 1]; if (!((a == ends[i][0] && b == ends[i][1]) || (a == ends[i][1] && b == ends[i][0]))) return false; }
  return true;
}
static void begin(uint8_t pair, uint8_t c) {
  trim(pair, 0);
  paths[pair][0] = c; plen[pair] = 1; owner[c] = pair; drawing = pair + 1; draw_cell(c); status();
}
static void step_to(uint8_t c) {   /* cursor moved to cell c while drawing */
  uint8_t pair = drawing - 1;
  uint8_t last = paths[pair][plen[pair] - 1];
  if (plen[pair] >= 2 && paths[pair][plen[pair] - 2] == c) { trim(pair, plen[pair] - 1); return; }  /* backtrack */
  if (c == last) return;
  /* must be orthogonally adjacent */
  int8_t d = (int8_t)c - (int8_t)last;
  if (!(d == 1 || d == -1 || d == (int8_t)n || d == -(int8_t)n)) return;
  if ((d == 1 && c % n == 0) || (d == -1 && last % n == 0)) return;
  uint8_t other; bool endc = is_end(c, &other);
  if (endc && other != pair) return;                   /* another pair's endpoint blocks */
  if (owner[c] != OWNER_NONE) {
    if (owner[c] == pair) return;
    uint8_t o = owner[c], pos = 0; while (paths[o][pos] != c) pos++;
    trim(o, pos);
  }
  paths[pair][plen[pair]++] = c; owner[c] = pair; draw_cell(last); draw_cell(c);
  if (endc) { drawing = 0; status(); sfx_ok(); if (complete()) { sfx_win(); sv.done |= 1 << level; if (sv.solved[level] < 255) sv.solved[level]++; sv.next[level] = (idx + 1) % PUZ_PER_LEVEL; save_store(MAGIC, &sv, sizeof sv); win_panel("All connected!", "Solved:", ""); ui_num(11, 8, sv.solved[level], 4); win_wait(); drawing = 0xFE; } }
  else sfx_tick();
}

static void play(void) {
  load(); draw_all();
  while (1) {
    cursor_show((gx0 + cx) * 8, (gy0 + cy) * 8, 8);
    frame();
    uint8_t ox = cx, oy = cy;
    if ((keys_rep & J_LEFT) && cx) cx--;
    else if ((keys_rep & J_RIGHT) && cx < n - 1) cx++;
    else if ((keys_rep & J_UP) && cy) cy--;
    else if ((keys_rep & J_DOWN) && cy < n - 1) cy++;
    if ((ox != cx || oy != cy) && drawing) {
      step_to(cy * n + cx);
      if (drawing == 0xFE) return;
      if (drawing) { uint8_t pair = drawing - 1, last = paths[pair][plen[pair] - 1]; if (last != cy * n + cx) { cx = last % n; cy = last / n; } }
    }
    if (keys_hit & J_A) {
      uint8_t c = cy * n + cx, pair;
      if (drawing) { drawing = 0; status(); }
      else if (is_end(c, &pair)) begin(pair, c);
      else if (owner[c] != OWNER_NONE) { uint8_t o = owner[c], pos = 0; while (paths[o][pos] != c) pos++; trim(o, pos + 1); drawing = o + 1; status(); }
      else { sfx_bad(); }
    } else if (keys_hit & J_B) { if (drawing) { drawing = 0; status(); } }
    else if (keys_hit & J_START) {
      static const char *const items[] = { "Continue", "Start over", "Next puzzle", "Choose size" };
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
  title_screen("CIRCUIT PATHS", "Join each pair of", "numbers. No crossing.", "Use every square.");
  level = 0;
  while (1) {
    level = level_select("CIRCUIT PATHS", PUZ_LEVELS, LABELS, level, sv.done);
    idx = sv.next[level] % PUZ_PER_LEVEL;
    save_store(MAGIC, &sv, sizeof sv);
    play();
  }
}
