/* Persistence: everything lives in localStorage on the host phone. */
(function () {
  'use strict';
  const KEY = 'stackSettle.v1';
  const S = window.S = {};

  S.defaults = () => ({
    v: 1,
    settings: { theme: 'auto', lang: 'en', sound: true },
    profiles: [],   // {id, name, etransfer, wechat, createdAt}
    chipSets: [],   // the host's own chip sets: {id, name, colours:[{id,name,color,chips,have}], usedAt}
    games: [],      // finished games
    current: null,  // game in progress (phase 'play' or 'count')
    draft: null,    // game setup in progress
    lastBackup: 0,
  });

  S.load = function () {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    S.db = Object.assign(S.defaults(), db || {});
    S.db.settings = Object.assign(S.defaults().settings, S.db.settings || {});
  };
  S.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(S.db)); }
    catch (e) { U.toast(T('Could not save. Is storage full?'), 'bad'); }
  };
  /* mutate, save, re-render */
  S.commit = function (fn) {
    if (fn) fn(S.db);
    S.save();
    if (window.App) App.render();
  };

  /* ---------- profiles ---------- */
  S.profile = id => S.db.profiles.find(p => p.id === id) || null;
  S.findProfile = name => {
    const n = String(name).trim().toLowerCase();
    return S.db.profiles.find(p => p.name.trim().toLowerCase() === n) || null;
  };
  S.ensureProfile = function (name) {
    name = String(name).trim();
    let p = S.findProfile(name);
    if (!p) {
      p = { id: U.uid(), name, etransfer: '', wechat: '', createdAt: Date.now() };
      S.db.profiles.push(p);
    }
    return p;
  };
  S.nameOf = id => (S.profile(id) || {}).name || '?';

  /* ---------- saved chip sets ---------- */
  S.chipSet = id => S.db.chipSets.find(s => s.id === id) || null;
  S.lastChipSet = () => S.db.chipSets.slice().sort((a, b) => b.usedAt - a.usedAt)[0] || null;
  /* create or update a saved set (no re-render, so inputs keep focus) */
  S.saveChipSet = function (id, name, colours) {
    let set = S.chipSet(id);
    if (!set) { set = { id }; S.db.chipSets.push(set); }
    Object.assign(set, { name: String(name || '').trim(), colours: U.clone(colours), usedAt: Date.now() });
    S.save();
    return set;
  };
  S.deleteChipSet = id => { S.db.chipSets = S.db.chipSets.filter(s => s.id !== id); };

  S.game = id => S.db.games.find(g => g.id === id) || null;
  S.lastGame = () => Core.doneGames(S.db.games).slice(-1)[0] || null;

  /* ---------- backup ---------- */
  S.exportBlob = function () {
    const data = Object.assign({}, S.db, { exportedAt: Date.now(), app: 'stack-and-settle' });
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  };
  S.exportNow = function () {
    const d = new Date();
    const name = 'stack-settle-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
    U.download(S.exportBlob(), name);
    S.db.lastBackup = Date.now();
    S.save();
  };
  S.validImport = obj => obj && typeof obj === 'object' && Array.isArray(obj.profiles) && Array.isArray(obj.games);
  S.importData = function (obj) {
    const db = Object.assign(S.defaults(), obj);
    delete db.exportedAt; delete db.app;
    db.settings = Object.assign(S.defaults().settings, obj.settings || {});
    S.db = db;
    S.save();
  };
  S.wipe = function () {
    const settings = S.db.settings;
    S.db = S.defaults();
    S.db.settings = settings;
    S.save();
  };
})();
