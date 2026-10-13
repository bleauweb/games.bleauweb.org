import { LEVELS, newGame, move, canMove, solved, nextMove, optimal, undo } from './hanoi.js';
import { calmControls, makeSounds, loadCalm } from '/shared/calm.js';

const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const KEY = 'stacks.save.v1';
const COLORS = ['#e05a5a', '#e8a33d', '#e6d84a', '#4cc25e', '#2dd4bf', '#4f8fff', '#b26ee6'];
let save = load();
let calm = loadCalm();
const sounds = makeSounds(() => calm);
let level = null;
let g = null;
let picked = null;
let hint = null;

function load() { try { return { best: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { best: {} }; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }

function renderTitle() {
  const list = $('levels');
  list.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const best = save.best[lv.id];
    const b = document.createElement('button');
    b.className = 'level';
    b.innerHTML = `<div><div class="name">${i + 1}. ${lv.name}</div><div class="meta">${lv.tip}</div></div>${best ? `<span class="${best === optimal(lv.discs) ? 'done' : 'prog'}">${best === optimal(lv.discs) ? '✓ perfect' : `best ${best}`}</span>` : ''}`;
    b.addEventListener('click', () => start(lv));
    list.append(b);
  });
}
calm = calmControls($('calm'), (c) => { calm = c; });
$('btn-reset').addEventListener('click', () => { if (confirm('Reset your progress?')) { localStorage.removeItem(KEY); save = load(); renderTitle(); } });

function start(lv) {
  level = lv;
  g = newGame(lv.discs);
  picked = null;
  hint = null;
  show($('screen-title'), false);
  show($('screen-play'), true);
  $('play-title').textContent = lv.name;
  $('play-sub').textContent = `Fewest possible: ${optimal(lv.discs)} moves. Move everything to the right-hand peg.`;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  render();
}
function render() {
  const pegs = $('pegs');
  pegs.classList.toggle('solved', solved(g));
  pegs.innerHTML = g.pegs.map((peg, p) => `<button class="peg ${picked === p ? 'sel' : ''} ${hint && (hint[0] === p || hint[1] === p) ? 'hint' : ''}" data-peg="${p}"><span class="label">${['Start', 'Spare', 'Goal'][p]}</span>${peg.map((d, i) => `<div class="disc ${picked === p && i === peg.length - 1 ? 'lifted' : ''}" style="width:${28 + (d / g.discs) * 68}%;background:${COLORS[d - 1]}"></div>`).join('')}</button>`).join('');
  $('play-right').textContent = `${g.moves} move${g.moves === 1 ? '' : 's'}`;
}
$('pegs').addEventListener('click', (e) => {
  const b = e.target.closest('.peg');
  if (!b || solved(g)) return;
  const p = Number(b.dataset.peg);
  hint = null;
  if (picked === null) {
    if (!g.pegs[p].length) return;
    picked = p;
    sounds.tap();
  } else if (picked === p) {
    picked = null;
  } else if (canMove(g, picked, p)) {
    move(g, picked, p);
    picked = null;
    sounds.click(500 + p * 120);
    if (solved(g)) {
      const best = save.best[level.id];
      save.best[level.id] = best ? Math.min(best, g.moves) : g.moves;
      persist();
      const perfect = g.moves === optimal(g.discs);
      $('feedback').textContent = perfect ? `Solved in ${g.moves} moves, the fewest possible.` : `Solved in ${g.moves} moves. The fewest possible is ${optimal(g.discs)}.`;
      $('feedback').className = 'feedback ok pop';
      sounds.done();
    }
  } else {
    $('feedback').textContent = 'A bigger disc cannot sit on a smaller one.';
    $('feedback').className = 'feedback hint';
    sounds.gentle();
    picked = null;
  }
  render();
});
$('btn-hint').addEventListener('click', () => { if (solved(g)) return; hint = nextMove(g); picked = null; $('feedback').textContent = hint ? `Move the top disc from ${['Start', 'Spare', 'Goal'][hint[0]]} to ${['Start', 'Spare', 'Goal'][hint[1]]}.` : ''; $('feedback').className = 'feedback hint'; render(); });
$('btn-undo').addEventListener('click', () => { if (undo(g)) { picked = null; hint = null; render(); } });
$('btn-restart').addEventListener('click', () => start(level));
$('btn-close').addEventListener('click', () => { show($('screen-play'), false); renderTitle(); show($('screen-title'), true); });
renderTitle();
window.stacks = { get game() { return g; }, start, LEVELS };
