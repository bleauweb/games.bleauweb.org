// Screens, buttons, save data. The 3D game itself lives in game.js.
import { Game } from './game.js';
import { generateLevel } from './level.js';
import { loadSave, writeSave, resetSave } from './save.js';
import { UPGRADES, statsFor } from './upgrades.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);

let save = loadSave();
let selected = save.level;
let current = null; // level definition in play
let hintTimer = 0;

const game = new Game($('stage'), {
  onHud: ({ coins }) => {
    $('hud-coins').textContent = String(coins);
  },
  onEnd: endLevel,
});
audio.setMuted(save.muted);

// ---------- title screen ----------

function stars(n, big = false) {
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
      writeSave(save);
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
  writeSave(save);
  renderTitle();
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress, coins and upgrades?')) return;
  save = resetSave();
  selected = 1;
  renderTitle();
});
$('btn-play').addEventListener('click', () => startLevel(selected));

// ---------- play ----------

function startLevel(n) {
  audio.unlock();
  audio.click();
  current = generateLevel(n);
  show($('screen-title'), false);
  show($('screen-end'), false);
  show($('screen-pause'), false);
  show($('hud'), true);
  $('hud-level').textContent = `Level ${n}`;
  $('hud-coins').textContent = '0';
  const hint = $('hint');
  hint.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add('fade'), 3500);
  game.start(current, statsFor(save.upgrades));
}

function endLevel(result) {
  const n = result.level;
  const bonus = result.won ? 8 + 2 * n : 0;
  const earned = result.coins + bonus;
  save.coins += earned;
  let starCount = 0;
  if (result.won) {
    const frac = result.enteredBossWith ? result.remaining / result.enteredBossWith : 0;
    starCount = frac >= 0.6 ? 3 : frac >= 0.3 ? 2 : 1;
    save.stars[n] = Math.max(save.stars[n] || 0, starCount);
    save.level = Math.max(save.level, n + 1);
    selected = n + 1;
  }
  writeSave(save);

  $('end-title').textContent = result.won ? (starCount === 3 ? 'Flawless!' : 'Victory') : 'Overrun';
  $('end-stars').innerHTML = result.won ? stars(starCount) : '';
  $('end-text').textContent = result.won
    ? `You beat level ${n} with ${result.remaining} troops left. Peak squad: ${result.peak}.`
    : `Your squad fell on level ${n}. Peak squad: ${result.peak}. Pick the gates that show the bigger number, and dodge side groups when you are small.`;
  $('end-rewards').innerHTML = `
    <div class="reward gold">+${earned} ◉<small>${result.coins} picked up${bonus ? ` · ${bonus} win bonus` : ''}</small></div>
    <div class="reward">${save.coins} ◉<small>in your wallet</small></div>`;
  $('btn-next').textContent = result.won ? 'Next level' : 'Try again';
  show($('btn-retry'), result.won);
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
