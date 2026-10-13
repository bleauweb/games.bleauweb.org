import { LEVELS, scramble, move, isSolved, pictureSvg, solvedTiles } from './slide.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'slide-picture.save.v1';
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let s = null;
let img = '';
let numbers = true;

function load() { try { return { best: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { best: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const best = save.best[lv.id];
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${lv.tip}</div></div>${best ? `<span class="done">✓ best ${best}</span>` : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv) {
  level = lv;
  const seed = Math.floor(Math.random() * 1e6);
  s = scramble(lv.n, lv.shuffle, seed);
  img = pictureSvg(seed);
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = 'Tap a tile in the same row or column as the gap.';
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('goal').style.backgroundImage = `url("${img}")`;
  render();
}
function render() {
  const n = s.n;
  const px = Math.max(44, Math.min(84, Math.floor((Math.min(window.innerWidth, 560) - 150) / n) - 3));
  const board = $('board');
  board.style.setProperty('--cell', `${px}px`);
  board.style.setProperty('--n', n);
  board.style.setProperty('--img', `url("${img}")`);
  board.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
  board.classList.toggle('nonum', !numbers);
  board.classList.toggle('solved', isSolved(s));
  board.innerHTML = s.tiles.map((t, i) => {
    const goalIdx = t === 0 ? n * n - 1 : t - 1;
    const gx = goalIdx % n;
    const gy = Math.floor(goalIdx / n);
    return `<button class="tile ${t === 0 && !isSolved(s) ? 'blank' : ''}" data-i="${i}" style="background-position: ${-gx * (px + 3)}px ${-gy * (px + 3)}px"><span class="num">${t || ''}</span></button>`;
  }).join('');
  $('play-right').textContent = isSolved(s) ? `Done in ${s.moves}` : `${s.moves} moves`;
}
$('board').addEventListener('click', (e) => {
  const b = e.target.closest('.tile');
  if (!b || isSolved(s)) return;
  if (move(s, Number(b.dataset.i))) {
    sounds.click(600);
    if (isSolved(s)) {
      const best = save.best[level.id];
      save.best[level.id] = best ? Math.min(best, s.moves) : s.moves;
      persist();
      $('feedback').textContent = `Picture complete in ${s.moves} moves.`;
      $('feedback').className = 'feedback ok pop';
      sounds.done();
    }
    render();
  }
});
$('btn-numbers').addEventListener('click', () => { numbers = !numbers; $('btn-numbers').textContent = `Numbers: ${numbers ? 'on' : 'off'}`; render(); });
$('btn-new').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
window.addEventListener('resize', () => { if (s && !$('screen-play').classList.contains('hidden')) render(); });
renderTitle();
window.slidePicture = { get state() { return s; }, start, LEVELS, setTiles(t) { s.tiles = t; render(); } };
