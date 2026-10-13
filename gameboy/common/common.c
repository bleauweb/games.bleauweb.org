#include "common.h"
#include <gbdk/font.h>
#include <string.h>

uint8_t keys = 0, keys_hit = 0, keys_rep = 0;
static uint8_t prev_keys = 0, rep_timer = 0;
bool sound_on = true;
static uint16_t rng = 0xACE1;

void input_update(void) {
  uint8_t k = joypad();
  keys_hit = k & ~prev_keys;
  keys_rep = keys_hit;
  uint8_t d = k & 0x0F;
  if (d && d == (prev_keys & 0x0F)) {
    if (rep_timer) rep_timer--;
    else { rep_timer = 5; keys_rep |= d; }
  } else rep_timer = 14;
  keys = k;
  prev_keys = k;
}

void frame(void) { wait_vbl_done(); input_update(); sfx_update(); }

void rng_seed(uint16_t s) { rng = s ? s : 0xACE1; }
uint16_t rng_next(void) { rng ^= rng << 7; rng ^= rng >> 9; rng ^= rng << 8; return rng; }
uint8_t rng_range(uint8_t n) { return (uint8_t)(rng_next() % n); }

/* ---- drawing ---- */
void ui_init(void) {
  DISPLAY_OFF;
  font_init();
  font_set(font_load(font_ibm));
  set_bkg_data(COMMON_FIRST, COMMON_COUNT, common_tiles);
  set_sprite_data(SPRITES_FIRST, SPRITES_COUNT, sprites_tiles);
  ui_cls();
  for (uint8_t i = 0; i < 40; i++) move_sprite(i, 0, 0);
  SHOW_BKG; SHOW_SPRITES; DISPLAY_ON;
}
void ui_cls(void) { fill_bkg_rect(0, 0, 20, 18, 0); }
void ui_text(uint8_t x, uint8_t y, const char *s) {
  uint8_t buf[20]; uint8_t n = 0;
  while (1) {
    char c = *s++;
    if (c == '\n' || c == 0) {
      if (n) set_bkg_tiles(x, y, n, 1, buf);
      if (c == 0) return;
      y++; n = 0; continue;
    }
    if (n < 20) buf[n++] = (uint8_t)c - 32;
  }
}
void ui_textc(uint8_t y, const char *s) {
  uint8_t len = 0; while (s[len] && s[len] != '\n') len++;
  ui_text((20 - len) >> 1, y, s);
}
void ui_num(uint8_t x, uint8_t y, uint16_t n, uint8_t width) {
  uint8_t buf[6]; uint8_t i = 5;
  buf[i] = 0;
  do { buf[--i] = (uint8_t)('0' + n % 10); n /= 10; } while (n && i);
  uint8_t len = 5 - i;
  while (len < width && i) { buf[--i] = ' '; len++; }
  ui_text(x, y, (const char *)&buf[i]);
}
void ui_fill(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t tile) { fill_bkg_rect(x, y, w, h, tile); }
void ui_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *tiles) { set_bkg_tiles(x, y, w, h, tiles); }
void ui_tile(uint8_t x, uint8_t y, uint8_t tile) { set_bkg_tile_xy(x, y, tile); }
void ui_tile2(uint8_t x, uint8_t y, uint8_t first) {
  uint8_t t[4]; t[0] = first; t[1] = first + 1; t[2] = first + 2; t[3] = first + 3;
  set_bkg_tiles(x, y, 2, 2, t);
}
void ui_load_tiles(uint8_t first, uint8_t n, const uint8_t *data) { set_bkg_data(first, n, data); }
void ui_frame(uint8_t x, uint8_t y, uint8_t w, uint8_t h) {
  fill_bkg_rect(x, y, w, 1, COMMON_HLINE);
  fill_bkg_rect(x, y + h - 1, w, 1, COMMON_HLINE);
  fill_bkg_rect(x, y + 1, 1, h - 2, COMMON_VLINE);
  fill_bkg_rect(x + w - 1, y + 1, 1, h - 2, COMMON_VLINE);
}

/* ---- cursor ---- */
void cursor_show(uint8_t px, uint8_t py, uint8_t size) {
  if (size == 8) {
    set_sprite_tile(0, SPRITES_BOX8); set_sprite_prop(0, 0);
    move_sprite(0, px + 8, py + 16);
    move_sprite(1, 0, 0); move_sprite(2, 0, 0); move_sprite(3, 0, 0);
    return;
  }
  uint8_t s = size - 8;
  set_sprite_tile(0, SPRITES_CORNER); set_sprite_prop(0, 0);
  set_sprite_tile(1, SPRITES_CORNER); set_sprite_prop(1, S_FLIPX);
  set_sprite_tile(2, SPRITES_CORNER); set_sprite_prop(2, S_FLIPY);
  set_sprite_tile(3, SPRITES_CORNER); set_sprite_prop(3, S_FLIPX | S_FLIPY);
  move_sprite(0, px + 8, py + 16);
  move_sprite(1, px + 8 + s, py + 16);
  move_sprite(2, px + 8, py + 16 + s);
  move_sprite(3, px + 8 + s, py + 16 + s);
}
void cursor_hide(void) { for (uint8_t i = 0; i < 4; i++) move_sprite(i, 0, 0); }
void marker_show(uint8_t n, uint8_t px, uint8_t py, uint8_t tile) {
  set_sprite_tile(4 + n, tile); set_sprite_prop(4 + n, 0); move_sprite(4 + n, px + 8, py + 16);
}
void marker_hide(uint8_t n) { move_sprite(4 + n, 0, 0); }

/* ---- sound: a tiny sequencer, pairs of (note index, frames), 0xFF ends ---- */
static const uint16_t notes[] = { 0, N_C4, N_E4, N_G4, N_A4, N_C5, N_D5, N_E5, N_G5, N_A5, N_C6, N_E6 };
static const uint8_t *seq = 0; static uint8_t seq_t = 0;
static void play_note(uint16_t f) {
  NR10_REG = 0x00; NR11_REG = 0x80; NR12_REG = 0xA2;
  NR13_REG = (uint8_t)f; NR14_REG = 0x80 | (uint8_t)(f >> 8);
}
static void stop_note(void) { NR12_REG = 0x08; NR14_REG = 0x80; }
void sfx_init(void) { NR52_REG = 0x80; NR50_REG = 0x77; NR51_REG = 0x11; }
void sfx_update(void) {
  if (!seq) return;
  if (seq_t) { seq_t--; if (!seq_t) { stop_note(); } return; }
  uint8_t n = *seq++;
  if (n == 0xFF) { seq = 0; return; }
  seq_t = *seq++;
  if (n) play_note(notes[n]);
}
static void start_seq(const uint8_t *s) { if (!sound_on) return; seq = s; seq_t = 0; sfx_update(); }
static const uint8_t SEQ_TICK[] = { 10, 2, 0xFF };
static const uint8_t SEQ_OK[] = { 7, 3, 8, 3, 10, 5, 0xFF };
static const uint8_t SEQ_BAD[] = { 2, 4, 1, 6, 0xFF };
static const uint8_t SEQ_WIN[] = { 5, 4, 7, 4, 8, 4, 10, 4, 0, 2, 10, 10, 0xFF };
void sfx_tick(void) { start_seq(SEQ_TICK); }
void sfx_ok(void) { start_seq(SEQ_OK); }
void sfx_bad(void) { start_seq(SEQ_BAD); }
void sfx_win(void) { start_seq(SEQ_WIN); }
static uint8_t one_note[3];
void sfx_note(uint16_t f, uint8_t frames) {
  if (!sound_on) return;
  seq = 0; play_note(f); seq_t = frames; one_note[0] = 0xFF; seq = one_note; /* seq_t counts down then stops */
}

/* ---- save ---- */
bool save_load(uint16_t magic, void *buf, uint8_t len) {
  ENABLE_RAM;
  uint8_t *p = (uint8_t *)0xA000;
  bool ok = p[0] == (uint8_t)magic && p[1] == (uint8_t)(magic >> 8);
  if (ok) { sound_on = p[2] != 0; memcpy(buf, p + 3, len); }
  DISABLE_RAM;
  return ok;
}
void save_store(uint16_t magic, const void *buf, uint8_t len) {
  ENABLE_RAM;
  uint8_t *p = (uint8_t *)0xA000;
  p[0] = (uint8_t)magic; p[1] = (uint8_t)(magic >> 8); p[2] = sound_on ? 1 : 0;
  memcpy(p + 3, buf, len);
  DISABLE_RAM;
}

/* ---- screens ---- */
void wait_frames(uint8_t n) { while (n--) frame(); }
void wait_key(void) { do { frame(); } while (!(keys_hit & (J_A | J_START))); }

void title_screen(const char *name, const char *l1, const char *l2, const char *l3) {
  ui_cls(); cursor_hide();
  ui_frame(0, 0, 20, 18);
  ui_textc(3, name);
  ui_fill(4, 4, 12, 1, COMMON_HLINE);
  ui_textc(7, l1); ui_textc(8, l2); ui_textc(9, l3);
  ui_textc(13, "Press START");
  ui_textc(15, "bleauweb games");
  uint16_t t = 0;
  do { frame(); t++; } while (!(keys_hit & (J_A | J_START)));
  rng_seed(t ^ ((uint16_t)DIV_REG << 8) ^ sys_time);
}

uint8_t ui_menu(const char *title, const char *const *items, uint8_t n, uint8_t cur) {
  ui_cls(); cursor_hide();
  ui_frame(0, 0, 20, 18);
  ui_textc(2, title);
  for (uint8_t i = 0; i < n; i++) ui_text(4, 5 + i, items[i]);
  ui_text(2, 16, "A: choose");
  while (1) {
    ui_fill(2, 5, 1, n, 0);
    ui_text(2, 5 + cur, ">");
    frame();
    if ((keys_rep & J_UP) && cur) { cur--; sfx_tick(); }
    else if ((keys_rep & J_DOWN) && cur < n - 1) { cur++; sfx_tick(); }
    else if (keys_hit & (J_A | J_START)) { sfx_ok(); return cur; }
  }
}

uint8_t level_select(const char *name, uint8_t n, const char *const *labels, uint8_t cur, uint8_t done_bits) {
  ui_cls(); cursor_hide();
  ui_frame(0, 0, 20, 18);
  ui_textc(2, name);
  for (uint8_t i = 0; i < n; i++) {
    ui_text(4, 4 + i, labels[i]);
    if (done_bits & (1 << i)) ui_tile(16, 4 + i, COMMON_CHECK);
  }
  ui_text(2, 14, "A: play");
  while (1) {
    ui_fill(2, 4, 1, n, 0);
    ui_text(2, 4 + cur, ">");
    ui_text(2, 15, sound_on ? "SELECT: sound on " : "SELECT: sound off");
    frame();
    if ((keys_rep & J_UP) && cur) { cur--; sfx_tick(); }
    else if ((keys_rep & J_DOWN) && cur < n - 1) { cur++; sfx_tick(); }
    else if (keys_hit & J_SELECT) { sound_on = !sound_on; sfx_tick(); }
    else if (keys_hit & (J_A | J_START)) { sfx_ok(); return cur; }
  }
}

void win_panel(const char *l1, const char *l2, const char *l3) {
  cursor_hide();
  ui_fill(1, 6, 18, 6, 0); ui_frame(1, 6, 18, 6);
  ui_textc(7, l1); ui_text(4, 8, l2); ui_text(4, 9, l3);
  ui_textc(10, "A: continue");
}
void win_wait(void) { wait_frames(10); wait_key(); }
void win_screen(const char *l1, const char *l2, const char *l3) { win_panel(l1, l2, l3); win_wait(); }
