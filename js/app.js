/* App shell: top bar, bottom tabs, routing, theme, timers. */
(function () {
  'use strict';
  const App = window.App = { tab: 'play', view: null };
  const h = U.h;
  let lastKey = '';

  App.applySettings = function () {
    const st = S.db.settings;
    const root = document.documentElement;
    if (st.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', st.theme);
    I18N.set(st.lang);
    root.lang = st.lang === 'zh' ? 'zh-CN' : 'en';
    const dark = st.theme === 'dark' || (st.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0d0d0d' : '#ffffff');
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
      h('div', { class: 'row gap-s' },
        h('button', { class: 'icon-btn', 'aria-label': T('Language'), onclick: () => { st.lang = st.lang === 'zh' ? 'en' : 'zh'; S.save(); App.applySettings(); App.render(); } }, st.lang === 'zh' ? 'EN' : '中'),
        h('button', { class: 'icon-btn', 'aria-label': T('Theme'), onclick: () => {
          const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
            (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
          st.theme = dark ? 'light' : 'dark'; S.save(); App.applySettings(); App.render();
        } }, '◐'),
        h('button', { class: 'icon-btn', 'aria-label': st.sound ? T('Mute') : T('Unmute'), onclick: () => { st.sound = !st.sound; S.save(); App.render(); if (st.sound) Snd.clack(); } }, st.sound ? '🔊' : '🔇')));
  }

  function tabs() {
    const live = !!S.db.current;
    const item = (id, icon, label) => h('button', {
      class: 'tab' + (App.tab === id ? ' on' : ''), 'aria-current': App.tab === id ? 'page' : null,
      onclick: () => { App.tab = id; App.view = null; U.closeAllSheets(); App.render(); window.scrollTo(0, 0); },
    }, h('span', { class: 'tab-icon' }, icon, id === 'play' && live ? h('i', { class: 'live-dot' }) : null), h('span', null, label));
    return h('nav', { class: 'tabs' },
      item('play', '♠', T('Play')), item('history', '🗂', T('History')), item('players', '👥', T('Players')), item('settings', '⚙', T('Settings')));
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
