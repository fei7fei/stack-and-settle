/* App shell: top bar, bottom tabs, routing, theme, timers. */
(function () {
  'use strict';
  const App = window.App = { tab: 'play', view: null };
  const h = U.h;
  let lastKey = '';

  /* SF Symbols-style line icons, drawn on a 24px grid in currentColor. */
  const ICONS = {
    play: '<path d="M12 3.2c2.6 3 7.6 6.4 7.6 10.1 0 2.4-1.9 4.1-4 4.1-1.3 0-2.4-.6-3-1.5.2 2 1 3.4 2.4 4.6H9c1.4-1.2 2.2-2.6 2.4-4.6-.6.9-1.7 1.5-3 1.5-2.1 0-4-1.7-4-4.1 0-3.7 5-7.1 7.6-10.1z" fill="currentColor"/>',
    history: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.2V12l3.2 2.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    players: '<circle cx="9" cy="8.4" r="3.4" fill="currentColor"/><path d="M2.6 19.2c.4-3.4 3-5.4 6.4-5.4s6 2 6.4 5.4c0 .5-.3.8-.8.8H3.4c-.5 0-.8-.3-.8-.8z" fill="currentColor"/><circle cx="16.6" cy="9.2" r="2.8" fill="currentColor" opacity=".55"/><path d="M16.2 13.9c2.9 0 4.9 1.8 5.2 4.6 0 .4-.2.7-.6.7h-4.1c-.2-2-1-3.6-2.3-4.8.5-.3 1.1-.5 1.8-.5z" fill="currentColor" opacity=".55"/>',
    settings: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="3.6 3.47"/><path d="M12 4.6a7.4 7.4 0 1 0 0 14.8a7.4 7.4 0 1 0 0-14.8zM12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z" fill="currentColor" fill-rule="evenodd"/>',
    theme: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor"/>',
    sound: '<path d="M4 9.2h3.2L11.6 5v14l-4.4-4.2H4z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 9a4.2 4.2 0 0 1 0 6M17.6 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    mute: '<path d="M4 9.2h3.2L11.6 5v14l-4.4-4.2H4z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M15.4 9.4l5.2 5.2M20.6 9.4l-5.2 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const icon = name => h('span', { class: 'icon', 'aria-hidden': 'true', html: '<svg class="icon" viewBox="0 0 24 24">' + ICONS[name] + '</svg>' });

  App.applySettings = function () {
    const st = S.db.settings;
    const root = document.documentElement;
    if (st.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', st.theme);
    I18N.set(st.lang);
    root.lang = st.lang === 'zh' ? 'zh-CN' : 'en';
    const dark = st.theme === 'dark' || (st.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#f2f2f7');
  };

  function content() {
    if (App.view && App.view.name === 'results') return Results.render(App.view);
    if (App.tab === 'history') return Lists.history();
    if (App.tab === 'players') return Lists.players();
    if (App.tab === 'settings') return Lists.settings();
    if (S.db.current) return Game.render();
    if (S.db.draft) return Setup.render();
    return Lists.home();
  }
  function screenKey() {
    if (App.view) return 'v:' + App.view.id;
    if (App.tab !== 'play') return App.tab;
    if (S.db.current) return 'game:' + S.db.current.id + ':' + S.db.current.phase;
    if (S.db.draft) return 'draft:' + S.db.draft.step;
    return 'home';
  }

  function topBar() {
    const st = S.db.settings;
    return h('header', { class: 'topbar' },
      h('button', { class: 'brand', onclick: () => { App.view = null; App.tab = 'play'; App.render(); } }, h('span', { class: 'brand-mark' }, '♠'), 'Stack & Settle'),
      h('div', { class: 'glass glass-group' },
        h('button', { class: 'icon-btn', 'aria-label': T('Language'), onclick: () => { st.lang = st.lang === 'zh' ? 'en' : 'zh'; S.save(); App.applySettings(); App.render(); } }, st.lang === 'zh' ? 'EN' : '中'),
        h('button', { class: 'icon-btn', 'aria-label': T('Theme'), onclick: () => {
          const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
            (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
          st.theme = dark ? 'light' : 'dark'; S.save(); App.applySettings(); App.render();
        } }, icon('theme')),
        h('button', { class: 'icon-btn', 'aria-label': st.sound ? T('Mute') : T('Unmute'), onclick: () => { st.sound = !st.sound; S.save(); App.render(); if (st.sound) Snd.clack(); } }, icon(st.sound ? 'sound' : 'mute'))));
  }

  /* Floating glass tab bar. The selection pill slides from the last tab to the new one. */
  const TAB_IDS = ['play', 'history', 'players', 'settings'];
  let lastTabIdx = 0;
  function tabs() {
    const live = !!S.db.current;
    const idx = Math.max(0, TAB_IDS.indexOf(App.tab));
    const pill = h('i', { class: 'tab-pill', 'aria-hidden': 'true', style: '--i:' + idx + ';--from:' + lastTabIdx });
    if (idx !== lastTabIdx) pill.classList.add('slide');
    lastTabIdx = idx;
    const item = (id, label) => h('button', {
      class: 'tab' + (App.tab === id ? ' on' : ''), 'aria-current': App.tab === id ? 'page' : null,
      onclick: () => { App.tab = id; App.view = null; U.closeAllSheets(); App.render(); window.scrollTo(0, 0); },
    }, h('span', { class: 'tab-icon' }, icon(id), id === 'play' && live ? h('i', { class: 'live-dot' }) : null), h('span', null, label));
    return h('nav', { class: 'tabs' }, h('div', { class: 'glass tab-bar' }, pill,
      item('play', T('Play')), item('history', T('History')), item('players', T('Players')), item('settings', T('Settings'))));
  }

  App.render = function () {
    const root = document.getElementById('app');
    const key = screenKey();
    const same = key === lastKey;
    const y = window.scrollY;
    const main = h('main', { class: 'main' + (same ? '' : ' enter') }, content());
    U.clear(root);
    root.append(topBar(), main, tabs());
    if (same) window.scrollTo(0, y); else window.scrollTo(0, 0);
    lastKey = key;
  };

  App.start = function () {
    S.load();
    App.applySettings();
    App.render();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { App.applySettings(); });
    setInterval(() => { if (S.db.current) Game.tick(); }, 1000);
    window.addEventListener('storage', e => { if (e.key && e.key.startsWith('stackSettle')) { S.load(); App.render(); } });
    FX.intro();
  };

  document.addEventListener('DOMContentLoaded', App.start);
})();
