// The hub: search, filter by tag or section, sort, and favourite. Choices are remembered in
// localStorage next to the play counts the pages record (see shared/pwa.js).
const KEY = 'bleauweb.hub.v1';
const SORTS = { default: 'Suggested order', az: 'A to Z', recent: 'Recently played', most: 'Most played', favs: 'Favourites first' };

function load() {
  try { return { plays: {}, favs: [], tags: [], section: 'all', sort: 'default', q: '', compact: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { plays: {}, favs: [], tags: [], section: 'all', sort: 'default', q: '', compact: false }; }
}
function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }

const state = load();
const sections = [...document.querySelectorAll('h2.section')].map((h) => {
  const grid = h.nextElementSibling.matches('.grid') ? h.nextElementSibling : h.nextElementSibling.nextElementSibling;
  return { id: h.textContent.trim().toLowerCase().replace(/\s+/g, '-'), name: h.textContent.trim(), h, grid, note: h.nextElementSibling.matches('.grid') ? null : h.nextElementSibling };
});
const cards = [];
sections.forEach((sec) => {
  [...sec.grid.querySelectorAll('.card')].forEach((card, i) => {
    const slug = (card.getAttribute('href').match(/\/(?:games|tools)\/([a-z0-9-]+)\//) || [])[1];
    cards.push({ el: card, slug, section: sec, order: i, title: card.querySelector('h2').textContent.trim(), tags: [...card.querySelectorAll('.tag')].map((t) => t.textContent.trim()), text: card.textContent.toLowerCase() });
    const fav = document.createElement('button');
    fav.className = 'fav';
    fav.type = 'button';
    fav.title = 'Favourite';
    fav.setAttribute('aria-label', 'Favourite');
    fav.setAttribute('aria-pressed', 'false');
    fav.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const i2 = state.favs.indexOf(slug);
      if (i2 >= 0) state.favs.splice(i2, 1); else state.favs.push(slug);
      save(state);
      apply();
    });
    card.append(fav);
  });
});
const tagCounts = {};
for (const c of cards) for (const t of c.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
const allTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b));
const TOP_TAGS = 8;
let moreTags = false;

const bar = document.getElementById('hub-tools');
function renderBar() {
  bar.innerHTML = `
    <div class="hub-row">
      <input id="hub-q" class="hub-q" type="search" placeholder="Search games and tools" value="${state.q.replace(/"/g, '&quot;')}" />
      <select id="hub-sort" class="hub-sel" aria-label="Sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div>
    <div class="hub-row chips">
      <button class="hchip ${state.section === 'all' ? 'on' : ''}" data-section="all">All</button>
      ${sections.map((s) => `<button class="hchip ${state.section === s.id ? 'on' : ''}" data-section="${s.id}">${s.name}</button>`).join('')}
      <button class="hchip ${state.section === 'favs' ? 'on' : ''}" data-section="favs">♥ Favourites</button>
      <button class="hchip ${state.compact ? 'on' : ''}" data-compact="1">${state.compact ? 'Compact cards' : 'Full cards'}</button>
    </div>
    <div class="hub-row chips" id="hub-tags">
      ${allTags.filter((t, i) => moreTags || i < TOP_TAGS || state.tags.includes(t)).map((t) => `<button class="hchip tagchip ${state.tags.includes(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`).join('')}
      ${allTags.length > TOP_TAGS ? `<button class="hchip" data-more="1">${moreTags ? 'Fewer tags' : `More tags (${allTags.length - TOP_TAGS})`}</button>` : ''}
      ${state.tags.length || state.q || state.section !== 'all' ? '<button class="hchip clear" data-clear="1">Clear</button>' : ''}
    </div>
    <div class="hub-count muted" id="hub-count"></div>`;
}
bar.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.section) state.section = b.dataset.section;
  else if (b.dataset.tag) { const i = state.tags.indexOf(b.dataset.tag); if (i >= 0) state.tags.splice(i, 1); else state.tags.push(b.dataset.tag); }
  else if (b.dataset.clear) { state.tags = []; state.q = ''; state.section = 'all'; }
  else if (b.dataset.more) moreTags = !moreTags;
  else if (b.dataset.compact) state.compact = !state.compact;
  save(state);
  renderBar();
  apply();
});
bar.addEventListener('input', (e) => {
  if (e.target.id === 'hub-q') { state.q = e.target.value; save(state); apply(); }
});
bar.addEventListener('change', (e) => {
  if (e.target.id === 'hub-sort') { state.sort = e.target.value; save(state); apply(); }
});

function visible(c) {
  if (state.section === 'favs' && !state.favs.includes(c.slug)) return false;
  if (state.section !== 'all' && state.section !== 'favs' && c.section.id !== state.section) return false;
  if (state.tags.length && !state.tags.every((t) => c.tags.includes(t))) return false;
  if (state.q && !c.text.includes(state.q.toLowerCase())) return false;
  return true;
}
function sortKey(c) {
  const p = state.plays[c.slug] || { count: 0, last: 0 };
  const fav = state.favs.includes(c.slug) ? 1 : 0;
  switch (state.sort) {
    case 'az': return [c.title.toLowerCase()];
    case 'recent': return [-p.last, c.order];
    case 'most': return [-p.count, c.order];
    case 'favs': return [-fav, c.order];
    default: return [c.order];
  }
}
function cmp(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
  return 0;
}
function renderRecent() {
  const box = document.getElementById('hub-recent');
  if (!box) return;
  const recent = cards.filter((c) => state.plays[c.slug]).sort((a, b) => state.plays[b.slug].last - state.plays[a.slug].last).slice(0, 4);
  box.classList.toggle('hidden', recent.length === 0);
  if (!recent.length) return;
  box.innerHTML = `<h2 class="section" style="margin-top:0">Continue</h2><div class="recent-row">${recent.map((c) => `<a href="${c.el.getAttribute('href')}">${c.title}<small>played ${state.plays[c.slug].count}×</small></a>`).join('')}</div>`;
}
function describeFilters() {
  const parts = [];
  if (state.q) parts.push(`“${state.q}”`);
  if (state.section !== 'all') parts.push(state.section === 'favs' ? 'favourites' : sections.find((s) => s.id === state.section)?.name.toLowerCase());
  if (state.tags.length) parts.push(state.tags.join(', '));
  if (state.sort !== 'default') parts.push(SORTS[state.sort].toLowerCase());
  const el = document.getElementById('hub-active');
  if (el) el.textContent = parts.length ? parts.join(' · ') : '';
  const details = document.getElementById('hub-find');
  if (details && parts.length && !details.open) details.open = true;
}
function apply() {
  document.body.classList.toggle('compact', !!state.compact);
  renderRecent();
  describeFilters();
  let shown = 0;
  for (const sec of sections) {
    const mine = cards.filter((c) => c.section === sec);
    const vis = mine.filter(visible).sort(cmp);
    sec.grid.innerHTML = '';
    for (const c of vis) {
      const favEl = c.el.querySelector('.fav');
      favEl.classList.toggle('on', state.favs.includes(c.slug));
      favEl.setAttribute('aria-pressed', state.favs.includes(c.slug) ? 'true' : 'false');
      const p = state.plays[c.slug];
      let badge = c.el.querySelector('.played');
      if (!badge) { badge = document.createElement('span'); badge.className = 'played'; c.el.querySelector('.tags').append(badge); }
      badge.textContent = p && p.count ? `played ${p.count}×` : '';
      sec.grid.append(c.el);
    }
    const show = vis.length > 0;
    sec.h.classList.toggle('hidden', !show);
    sec.grid.classList.toggle('hidden', !show);
    if (sec.note) sec.note.classList.toggle('hidden', !show);
    shown += vis.length;
  }
  const count = document.getElementById('hub-count');
  if (count) count.textContent = shown === cards.length ? `${shown} games and tools` : `${shown} of ${cards.length} shown`;
  document.getElementById('hub-empty').classList.toggle('hidden', shown > 0);
}
renderBar();
apply();
