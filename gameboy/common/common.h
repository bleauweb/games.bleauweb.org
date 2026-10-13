#ifndef COMMON_H
#define COMMON_H
#include <gb/gb.h>
#include <stdint.h>
#include <stdbool.h>
#include "common_tiles.h"
#include "sprite_tiles.h"

/* Tile map: 0-95 font (char - 32), 96-127 free, 128+ common tiles, COMMON_FIRST+COMMON_COUNT.. game tiles, 240+ sprites. */
#define T_GAME (COMMON_FIRST + COMMON_COUNT)

/* ---- input (edge + d-pad repeat) ---- */
extern uint8_t keys, keys_hit, keys_rep;
void input_update(void);
void frame(void);                      /* wait_vbl_done + input_update + sfx_update */

/* ---- random ---- */
void rng_seed(uint16_t s);
uint16_t rng_next(void);
uint8_t rng_range(uint8_t n);

/* ---- drawing ---- */
void ui_init(void);
void ui_cls(void);
void ui_text(uint8_t x, uint8_t y, const char *s);     /* '\n' moves to the next row, same x */
void ui_textc(uint8_t y, const char *s);               /* centred */
void ui_num(uint8_t x, uint8_t y, uint16_t n, uint8_t width);
void ui_fill(uint8_t x, uint8_t y, uint8_t w, uint8_t h, uint8_t tile);
void ui_tiles(uint8_t x, uint8_t y, uint8_t w, uint8_t h, const uint8_t *tiles);
void ui_tile(uint8_t x, uint8_t y, uint8_t tile);
void ui_tile2(uint8_t x, uint8_t y, uint8_t first);    /* 2x2 metatile, tiles first..first+3 */
void ui_load_tiles(uint8_t first, uint8_t n, const uint8_t *data);
void ui_frame(uint8_t x, uint8_t y, uint8_t w, uint8_t h);  /* box drawn with SOLID2 border */

/* ---- cursor sprites (0-3) ---- */
void cursor_show(uint8_t px, uint8_t py, uint8_t size);  /* size 8 or 16, pixel pos on screen */
void cursor_hide(void);
void marker_show(uint8_t n, uint8_t px, uint8_t py, uint8_t tile); /* extra sprites 4.. */
void marker_hide(uint8_t n);

/* ---- sound ---- */
extern bool sound_on;
void sfx_init(void);
void sfx_update(void);
void sfx_tick(void);
void sfx_ok(void);
void sfx_bad(void);
void sfx_win(void);
void sfx_note(uint16_t f, uint8_t frames); /* single square-wave note, f = 11-bit GB freq value */

/* ---- save (SRAM): header magic(2) sound(1) then payload ---- */
bool save_load(uint16_t magic, void *buf, uint8_t len);
void save_store(uint16_t magic, const void *buf, uint8_t len);

/* ---- standard screens ---- */
void title_screen(const char *name, const char *l1, const char *l2, const char *l3);
uint8_t level_select(const char *name, uint8_t n, const char *const *labels, uint8_t cur, uint8_t done_bits);
uint8_t ui_menu(const char *title, const char *const *items, uint8_t n, uint8_t cur);
void win_screen(const char *l1, const char *l2, const char *l3);
void win_panel(const char *l1, const char *l2, const char *l3);  /* draw only; add numbers then win_wait() */
void win_wait(void);
void wait_frames(uint8_t n);
void wait_key(void);                   /* until A or START is hit */

/* note values (11-bit) */
#define N_C4 1548
#define N_E4 1651
#define N_G4 1714
#define N_A4 1750
#define N_C5 1797
#define N_D5 1820
#define N_E5 1849
#define N_G5 1881
#define N_A5 1899
#define N_C6 1923
#define N_E6 1949

#endif
