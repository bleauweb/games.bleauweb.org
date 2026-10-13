# Builds one Game Boy ROM per game directory under gameboy/games into public/roms.
# Uses the GBDK-2020 toolchain (the copy bundled with GB Studio works: see gameboy/README.md).
GBDK ?= $(HOME)/.local/share/gbdk
LCC := $(GBDK)/bin/lcc
PY ?= python3
GAMES := $(notdir $(wildcard games/*))
ROMS := $(GAMES:%=../public/roms/%.gb)
CFLAGS := -Wm-yt0x1B -Wm-ya1 -Wl-j -Wf-Icommon -Wf--opt-code-speed
COMMON_SRC := common/common.c common/common_tiles.c common/sprite_tiles.c

all: $(ROMS)

common/common_tiles.c common/common_tiles.h: common/common_tiles.txt tools/tiles2c.py
	$(PY) tools/tiles2c.py common/common_tiles.txt common/common_tiles common 128
common/sprite_tiles.c common/sprite_tiles.h: common/sprite_tiles.txt tools/tiles2c.py
	$(PY) tools/tiles2c.py common/sprite_tiles.txt common/sprite_tiles sprites 240

# game tiles: games/<g>/tiles.txt -> games/<g>/tiles.c/.h, first tile after the common set
games/%/tiles.c games/%/tiles.h: games/%/tiles.txt tools/tiles2c.py common/common_tiles.h
	$(PY) tools/tiles2c.py $< games/$*/tiles game $$(grep COMMON_COUNT common/common_tiles.h | awk '{print 128+$$3}')

# baked puzzles: gen/<g>.mjs -> games/<g>/puzzles.h (+ puzzles.json for the tests)
games/%/puzzles.h: gen/%.mjs gen/emit.mjs
	node gen/$*.mjs

define GAME_RULE
../public/roms/$(1).gb: $(wildcard games/$(1)/*.c) $(if $(wildcard games/$(1)/tiles.txt),games/$(1)/tiles.c) $(if $(wildcard gen/$(1).mjs),games/$(1)/puzzles.h) $(COMMON_SRC) common/common.h common/common_tiles.h common/sprite_tiles.h
	@mkdir -p ../public/roms build/$(1)
	$(LCC) $(CFLAGS) -Wf-Igames/$(1) -Wm-yn"$(shell cat games/$(1)/title)" -o $$@ $(COMMON_SRC) $(filter-out games/$(1)/tiles.c,$(wildcard games/$(1)/*.c)) $(if $(wildcard games/$(1)/tiles.txt),games/$(1)/tiles.c)
	@$(GBDK)/bin/romusage $$@ -sH 2>/dev/null | tail -1 || true
endef
$(foreach g,$(GAMES),$(eval $(call GAME_RULE,$(g))))

clean:
	rm -rf build ../public/roms/*.gb ../public/roms/*.noi ../public/roms/*.map common/*_tiles.c common/*_tiles.h games/*/tiles.c games/*/tiles.h games/*/puzzles.h games/*/puzzles.json

.PHONY: all clean
