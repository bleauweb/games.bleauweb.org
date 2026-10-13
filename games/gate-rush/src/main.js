// Screens, buttons, save data. The 3D game itself lives in game.js; the merge grid in base.js;
// the treasure rooms in pins.js (rules) and pinsView.js (drawing).
import { Game } from './game.js';
import { generateLevel } from './level.js';
import { TIERS } from './combat.js';
import { loadSave, writeSave, resetSave } from './save.js';
import { UPGRADES, statsFor } from './upgrades.js';
import { BaseGrid, armyBonus, recruitCost, addRecruit, mergeAll, freeSlot } from './base.js';
import { ROOMS } from './rooms.js';
import { PinRoom } from './pinsView.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const fmt = (n) => Number(n).toLocaleString('en-US');

let save = loadSave();
let selected = save.level;
let current = null; // level definition in play
let hintTimer = 0;
let vsTimer = 0;
let room = null; // PinRoom in play
let roomDef = null;

const game = new Game($('stage'), {
  onHud: ({ count, coins, power, tier, hero }) => {
    $('hud-count').textContent = fmt(count);
    $('hud-tier').textContent = TIERS[tier].name;
    $('hud-power').textContent = fmt(power);
    $('hud-hero').textContent = `Lv ${hero}`;
    $('hud-coins').textContent = String(coins);
  },
  onBoss: ({ you, boss }) => {
    const vs = $('vs');
    $('vs-you').textContent = fmt(you);
    $('vs-boss').textContent = fmt(boss);
    vs.classList.toggle('win', you >= boss);
    vs.classList.toggle('lose', you < boss);
    show(vs, true);
    clearTimeout(vsTimer);
    vsTimer = setTimeout(() => show(vs, false), 2600);
  },
  onEnd: endLevel,
});
audio.setMuted(save.muted);

function persist() {
  writeSave(save);
}

function roomsOpen() {
  return ROOMS.filter((_, i) => save.level > 2 * (i + 1)).length;
}

// ---------- title screen ----------

function stars(n) {
  let s = '';
  for (let i = 1; i <= 3; i++) s += `<span class="${i <= n ? '' : 'dim'}">★</span>`;
  return s;
}

function renderTitle() {
  selected = Math.min(Math.max(1, selected), save.level);
  $('title-level').textContent = String(selected);
  $('title-stars').innerHTML = save.stars[selected] ? stars(save.stars[selected]) : '<span class="dim">★★★</span>';
  $('lvl-prev').disabled = selected <= 1;
  $('lvl-next').disabled = selected >= save.level;
  $('title-coins').textContent = String(save.coins);
  $('btn-mute').textContent = `Sound: ${save.muted ? 'off' : 'on'}`;
  $('nav-army').textContent = `+${armyBonus(save.units)} troops`;
  const open = roomsOpen();
  const uncleared = ROOMS.slice(0, open).filter((r) => !save.rooms[r.id]?.cleared).length;
  $('nav-rooms').textContent = open ? `${open} open${uncleared ? ` · ${uncleared} new` : ''}` : 'opens at level 3';
  $('btn-rooms').classList.toggle('attention', uncleared > 0);
  $('btn-base').classList.toggle('attention', freeSlot(save.units) < 0);
  renderShop();
}

function renderShop() {
  const shop = $('shop');
  shop.innerHTML = '';
  for (const [key, u] of Object.entries(UPGRADES)) {
    const lvl = save.upgrades[key] || 0;
    const maxed = lvl >= u.max;
    const cost = maxed ? 0 : u.cost(lvl);
    const item = document.createElement('div');
    item.className = 'shop-item';
    item.innerHTML = `
      <div class="name">${u.name}<small>${u.show(lvl)}</small></div>
      <div class="desc">${u.desc} · ${lvl}/${u.max}</div>
      <button ${maxed || save.coins < cost ? 'disabled' : ''} class="${maxed ? 'maxed' : ''}">${maxed ? 'Max' : `${cost} ◉`}</button>`;
    item.querySelector('button').addEventListener('click', () => {
      if (maxed || save.coins < cost) return;
      save.coins -= cost;
      save.upgrades[key] = lvl + 1;
      persist();
      audio.unlock();
      audio.coin();
      renderTitle();
    });
    shop.appendChild(item);
  }
}

$('lvl-prev').addEventListener('click', () => { selected--; audio.click(); renderTitle(); });
$('lvl-next').addEventListener('click', () => { selected++; audio.click(); renderTitle(); });
$('btn-mute').addEventListener('click', () => {
  save.muted = !save.muted;
  audio.unlock();
  audio.setMuted(save.muted);
  persist();
  renderTitle();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress, coins, units and upgrades?')) return;
  save = resetSave();
  selected = 1;
  renderTitle();
});
$('btn-play').addEventListener('click', () => startLevel(selected));

// ---------- base (merge grid) ----------

const baseGrid = new BaseGrid($('base-grid'), {
  getUnits: () => save.units,
  onChange: () => {
    persist();
    renderBase();
  },
  onSound: (name) => {
    audio.unlock();
    audio.play(name);
  },
});

function renderBase() {
  const bonus = armyBonus(save.units);
  const base = generateLevel(selected).start.count;
  $('base-army').innerHTML = `Level ${selected} starts with <b>${base} + ${bonus} = ${base + bonus}</b> troops`;
  const cost = recruitCost(save.recruitsBought);
  const btn = $('btn-recruit');
  btn.textContent = `Recruit · ${cost} ◉`;
  btn.disabled = save.coins < cost;
  $('base-coins').textContent = String(save.coins);
  baseGrid.render();
}

$('btn-base').addEventListener('click', () => {
  audio.unlock();
  audio.click();
  show($('screen-title'), false);
  renderBase();
  show($('screen-base'), true);
});
$('btn-base-back').addEventListener('click', () => {
  show($('screen-base'), false);
  renderTitle();
  show($('screen-title'), true);
});
$('btn-recruit').addEventListener('click', () => {
  const cost = recruitCost(save.recruitsBought);
  if (save.coins < cost) return;
  if (!addRecruit(save.units)) return;
  save.coins -= cost;
  save.recruitsBought++;
  audio.coin();
  persist();
  renderBase();
});
$('btn-merge-all').addEventListener('click', () => {
  if (mergeAll(save.units) > 0) audio.merge();
  else audio.click();
  persist();
  renderBase();
});

// ---------- treasure rooms ----------

function renderRooms() {
  const list = $('rooms-list');
  list.innerHTML = '';
  ROOMS.forEach((def, i) => {
    const unlockAt = 2 * (i + 1);
    const open = save.level > unlockAt;
    const rec = save.rooms[def.id];
    const card = document.createElement('button');
    card.className = 'room-card';
    card.disabled = !open;
    card.innerHTML = `<div class="name">${i + 1}. ${def.name}</div><div class="hintline">${open ? def.hint : `Beat level ${unlockAt} to open`}</div><div class="state">${rec?.cleared ? '★ cleared' : open ? 'Enter ›' : '🔒'}</div>`;
    card.addEventListener('click', () => openRoom(def));
    list.appendChild(card);
  });
}

$('btn-rooms').addEventListener('click', () => {
  audio.unlock();
  audio.click();
  show($('screen-title'), false);
  show($('screen-end'), false);
  renderRooms();
  show($('screen-rooms'), true);
});
$('btn-rooms-back').addEventListener('click', () => {
  show($('screen-rooms'), false);
  renderTitle();
  show($('screen-title'), true);
});

function openRoom(def) {
  audio.unlock();
  audio.click();
  roomDef = def;
  show($('screen-rooms'), false);
  show($('screen-end'), false);
  $('room-name').textContent = def.name;
  $('room-hint').textContent = def.hint;
  show($('screen-room'), true);
  startRoom();
}

function startRoom() {
  room?.destroy();
  $('room-leave').disabled = true;
  $('room-status').textContent = 'Tap a pin to pull it.';
  room = new PinRoom($('room-canvas'), roomDef, {
    onSound: (name) => audio.play(name),
    onUpdate: (state, done) => {
      const left = state.pins.filter((p) => !p.pulled).length;
      if (!state.hero.alive) {
        $('room-status').textContent = 'The hero fell. Try a different order.';
        $('room-leave').disabled = true;
      } else {
        $('room-status').textContent = `Gold ${state.gold}/${state.goldTotal} · hero power ${state.hero.power} · ${left} pin${left === 1 ? '' : 's'} left`;
        $('room-leave').disabled = room.busy;
        if (done) finishRoom(state);
      }
    },
  });
}

function finishRoom(state) {
  if (!state.hero.alive) return;
  const rec = save.rooms[roomDef.id] || { gold: 0, cleared: false };
  const full = state.gold === state.goldTotal;
  const firstClear = full && !rec.cleared;
  const coins = state.gold * (rec.cleared ? 3 : 15);
  let recruits = 0;
  if (firstClear) {
    recruits = 1;
    addRecruit(save.units);
  }
  save.coins += coins;
  rec.gold = Math.max(rec.gold, state.gold);
  rec.cleared = rec.cleared || full;
  save.rooms[roomDef.id] = rec;
  persist();
  $('room-status').textContent = `${full ? 'All the gold!' : 'Left with some gold.'} +${coins} coins${recruits ? ', +1 recruit at the Base' : ''}.`;
  $('room-leave').disabled = true;
  room?.destroy();
  room = null;
  audio.win();
}

$('room-leave').addEventListener('click', () => {
  if (!room || room.busy || !room.state.hero.alive) return;
  finishRoom(room.state);
});
$('room-retry').addEventListener('click', () => { audio.click(); startRoom(); });
$('room-back').addEventListener('click', () => {
  room?.destroy();
  room = null;
  show($('screen-room'), false);
  renderRooms();
  show($('screen-rooms'), true);
});

// ---------- play ----------

function startLevel(n) {
  audio.unlock();
  audio.click();
  current = generateLevel(n);
  show($('screen-title'), false);
  show($('screen-end'), false);
  show($('screen-pause'), false);
  show($('vs'), false);
  show($('hud'), true);
  $('hud-level').textContent = `Level ${n}`;
  $('hud-coins').textContent = '0';
  const hint = $('hint');
  hint.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add('fade'), 3500);
  game.start(current, statsFor(save.upgrades, armyBonus(save.units)));
}

function endLevel(result) {
  const n = result.level;
  const bonus = result.won ? 8 + 2 * n : 0;
  const earned = result.coins + bonus;
  save.coins += earned;
  let starCount = 0;
  let recruits = 0;
  const roomsBefore = roomsOpen();
  if (result.won) {
    const frac = result.enteredBossWith ? result.remaining / result.enteredBossWith : 0;
    starCount = frac >= 0.6 ? 3 : frac >= 0.3 ? 2 : 1;
    save.stars[n] = Math.max(save.stars[n] || 0, starCount);
    const firstWin = save.level === n;
    save.level = Math.max(save.level, n + 1);
    selected = n + 1;
    recruits = firstWin ? 2 : 1;
    for (let i = 0; i < recruits; i++) if (!addRecruit(save.units)) save.coins += 5;
  }
  persist();
  const newRoom = roomsOpen() > roomsBefore;

  $('end-title').textContent = result.won ? (starCount === 3 ? 'Flawless!' : 'Victory') : 'Overrun';
  $('end-stars').innerHTML = result.won ? stars(starCount) : '';
  $('end-text').textContent = result.won
    ? `You beat level ${n} with ${fmt(result.remaining)} ${TIERS[result.tier].name} left and the hero at Lv ${result.hero}. Peak army: ${fmt(result.peak)}.`
    : `Your army fell on level ${n}. Peak army: ${fmt(result.peak)}. Pick the gate with the bigger result, dodge side groups when you are small, and merge units at the Base for a bigger start.`;
  $('end-rewards').innerHTML = `
    <div class="reward gold">+${earned} ◉<small>${result.coins} picked up${bonus ? ` · ${bonus} win bonus` : ''}</small></div>
    ${recruits ? `<div class="reward blue">+${recruits} recruit${recruits > 1 ? 's' : ''}<small>waiting at the Base</small></div>` : ''}
    <div class="reward">${save.coins} ◉<small>in your wallet</small></div>`;
  $('btn-next').textContent = result.won ? 'Next level' : 'Try again';
  show($('btn-retry'), result.won);
  show($('btn-room-unlocked'), newRoom);
  show($('hud'), false);
  show($('screen-end'), true);
}

$('btn-next').addEventListener('click', () => startLevel(selected));
$('btn-retry').addEventListener('click', () => startLevel(current ? current.n : selected));
$('btn-menu').addEventListener('click', () => {
  show($('screen-end'), false);
  renderTitle();
  show($('screen-title'), true);
});
$('btn-room-unlocked').addEventListener('click', () => {
  const open = roomsOpen();
  openRoom(ROOMS[open - 1]);
});

// ---------- pause ----------

function setPaused(on) {
  if (game.state !== 'running' && game.state !== 'boss') return;
  game.paused = on;
  show($('screen-pause'), on);
}
$('btn-pause').addEventListener('click', () => { audio.click(); setPaused(true); });
$('btn-resume').addEventListener('click', () => { audio.click(); setPaused(false); });
$('btn-quit').addEventListener('click', () => {
  game.paused = false;
  game.state = 'idle';
  show($('screen-pause'), false);
  show($('hud'), false);
  renderTitle();
  show($('screen-title'), true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') setPaused(!game.paused);
});

renderTitle();

// Handy for poking at the game from the console.
window.gateRush = game;
