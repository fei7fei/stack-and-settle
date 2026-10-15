/* Small DOM helpers, sheets, dialogs, toasts and formatting. */
(function () {
  'use strict';
  const U = window.U = {};

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.clone = o => JSON.parse(JSON.stringify(o));
  U.reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  U.h = function (tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'for') el.htmlFor = v;
        else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role') el.setAttribute(k, v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    U.append(el, kids);
    return el;
  };
  U.append = function (el, kids) {
    kids.forEach(function add(k) {
      if (k == null || k === false || k === true) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    });
    return el;
  };
  U.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* A poker chip drawn in CSS: the colour with edge inserts and an inner ring. Light chips get dark inserts so they still show. */
  U.chip = function (color, cls) {
    const el = U.h('span', { class: 'swatch' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    U.setChip(el, color);
    return el;
  };
  U.setChip = function (el, color) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color || '');
    const lum = m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 : 0;
    el.style.setProperty('--c', color);
    el.style.setProperty('--ins', lum > 0.75 ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.9)');
  };

  /* A −/+ button that repeats while held. A tap steps by 1; holding repeats and the step grows to 10, then 100,
     snapping to round numbers on the way. onStep(d) gets the signed step; it returns false to stop. */
  U.hold = function (sign, onStep, props) {
    let timer = null, ticks = 0;
    const stop = () => { clearTimeout(timer); timer = null; };
    const step = () => {
      const size = ticks < 8 ? 1 : ticks < 24 ? 10 : 100;
      ticks++;
      if (onStep(sign * size) === false) stop();
    };
    const loop = () => { step(); timer = setTimeout(loop, 70); };
    const btn = U.h('button', Object.assign({
      class: 'round-btn', type: 'button', 'aria-label': sign > 0 ? '+' : '−',
      onpointerdown: e => {
        if (e.button) return;
        ticks = 0; stop(); step();
        timer = setTimeout(loop, 400);
      },
      onpointerup: stop, onpointerleave: stop, onpointercancel: stop,
      oncontextmenu: e => e.preventDefault(),
      /* a pointer press already stepped; keyboard presses arrive as a click with detail 0 */
      onclick: e => { if (e.detail === 0) { ticks = 0; step(); } },
    }, props || {}), sign > 0 ? '+' : '−');
    return btn;
  };
  /* v moved by a step d, landing on a multiple of |d| (so holding goes 137 → 140 → 150) */
  U.snap = (v, d) => {
    const s = Math.abs(d);
    return d > 0 ? Math.floor(v / s) * s + s : Math.ceil(v / s) * s - s;
  };

  /* Bottom sheet. build(api) returns content; api.refresh() rebuilds it. */
  U.sheet = function (build, opts) {
    opts = opts || {};
    const h = U.h;
    const panel = h('div', { class: 'sheet ' + (opts.cls || ''), role: 'dialog', 'aria-modal': 'true' });
    const back = h('div', { class: 'sheet-back' }, panel);
    let closed = false;
    const api = {
      panel,
      close() {
        if (closed) return; closed = true;
        U.sheets = U.sheets.filter(x => x !== api);
        back.classList.remove('open');
        setTimeout(() => back.remove(), 220);
        if (opts.onclose) opts.onclose();
      },
      refresh() {
        const scroll = panel.scrollTop;
        U.clear(panel);
        panel.append(h('div', { class: 'sheet-grab' }));
        U.append(panel, [build(api)]);
        panel.scrollTop = scroll;
      },
    };
    back.addEventListener('click', e => { if (e.target === back && !opts.modal) api.close(); });
    document.body.append(back);
    api.refresh();
    requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add('open')));
    U.sheets.push(api);
    return api;
  };
  U.sheets = [];
  U.closeAllSheets = () => { U.sheets.forEach(s => s.close()); U.sheets = []; };

  /* confirm-style dialog -> Promise<boolean> */
  U.ask = function (o) {
    return new Promise(resolve => {
      const h = U.h;
      let done = false;
      const s = U.sheet(api => h('div', { class: 'dialog' },
        h('h3', null, o.title),
        o.body ? h('p', { class: 'muted' }, o.body) : null,
        h('div', { class: 'row gap end' },
          h('button', { class: 'btn ghost', onclick: () => { done = true; api.close(); resolve(false); } }, o.cancel || T('Cancel')),
          h('button', { class: 'btn ' + (o.danger ? 'danger' : 'primary'), onclick: () => { done = true; api.close(); resolve(true); } }, o.ok || T('OK')))
      ), { cls: 'small', onclose: () => { if (!done) resolve(false); } });
      return s;
    });
  };

  /* action: optional {label, fn} shown as a button in the toast (e.g. Undo); such toasts stay longer */
  U.toast = function (msg, kind, action) {
    let wrap = document.getElementById('toasts');
    if (!wrap) { wrap = U.h('div', { id: 'toasts' }); document.body.append(wrap); }
    const hide = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); };
    const t = U.h('div', { class: 'glass toast ' + (kind || '') + (action ? ' has-action' : '') }, h('span', null, msg),
      action ? h('button', { class: 'toast-action', onclick: () => { hide(); action.fn(); } }, action.label) : null);
    wrap.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(hide, action ? 6000 : kind === 'big' ? 3500 : 2400);
  };
  const h = U.h;

  const pad = n => String(n).padStart(2, '0');
  U.fmtTime = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  U.fmtDate = ts => new Date(ts).toLocaleDateString(window.I18N && I18N.lang === 'zh' ? 'zh-CN' : undefined,
    { month: 'short', day: 'numeric', year: 'numeric' });
  U.fmtShortDate = ts => new Date(ts).toLocaleDateString(window.I18N && I18N.lang === 'zh' ? 'zh-CN' : undefined,
    { month: 'short', day: 'numeric' });
  U.fmtDur = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return hh ? hh + ':' + pad(mm) + ':' + pad(ss) : mm + ':' + pad(ss);
  };
  U.fmtChips = n => (n < 0 ? '−' : '') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  /* animated count-up for an element showing a formatted number */
  U.countUp = function (el, to, format, ms) {
    format = format || String;
    if (U.reduced()) { el.textContent = format(to); return; }
    ms = ms || 900;
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = format(k < 1 ? Math.round(to * e) : to);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  U.download = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  U.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = U.h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
      document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); return ok;
    }
  };
})();
