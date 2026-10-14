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
    const t = U.h('div', { class: 'toast ' + (kind || '') + (action ? ' has-action' : '') }, h('span', null, msg),
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
