/* Full-screen "hand out these chips" screen for a buy-in: the suggested split in big rows, each count can be
   changed, and the colours the host hasn't touched rebalance so the total stays exact. Confirm only when exact. */
(function () {
  'use strict';
  const Helper = window.Helper = {};
  const h = U.h;

  /* o: {target, title, slots, max, current, fixedTarget, onConfirm(totalChips, mix)}
     slots: buy-ins the bank should still cover (see Core.bankMix); max: chip-leader cap for free mode;
     current: the mix of a buy-in being changed (its chips count as back in the bank); fixedTarget: no free mode */
  Helper.open = function (o) {
    const c = S.db.current.config;
    const colours = c.colours.slice().sort((a, b) => b.chips - a.chips);
    const bank = Core.bank(S.db.current);
    if (o.current) Object.keys(o.current).forEach(id => { if (bank[id] != null) bank[id] += o.current[id] || 0; });
    const sugg = Core.bankMix(o.target, colours, bank, o.slots || 1);
    const impossible = sugg.remainder > 0;
    const fixed = !!(c.buyin && c.buyin.fixed) || !!o.fixedTarget;
    const max = o.max || Infinity;
    let free = false;
    const counts = {};
    /* colours the host changed by hand; the others share what is left of the target */
    const pinned = new Set();
    const start = () => {
      pinned.clear();
      colours.forEach(col => { counts[col.id] = o.current ? (o.current[col.id] || 0) : impossible ? 0 : (sugg.mix[col.id] || 0); });
    };
    const rebalance = () => {
      const loose = colours.filter(col => !pinned.has(col.id));
      const rest = o.target - Core.mixTotal(counts, colours.filter(col => pinned.has(col.id)));
      if (!loose.length || rest < 0) return;
      const m = Core.bankMix(rest, loose, bank, o.slots || 1);
      if (!m.remainder) loose.forEach(col => { counts[col.id] = m.mix[col.id] || 0; });
    };
    start();

    U.sheet(api => {
      const totalEl = h('div', { class: 'helper-total' });
      const sumEl = h('div', { class: 'handout-sum' });
      const hint = h('div', { class: 'muted small center' });
      const reset = h('button', { class: 'btn ghost small', onclick: () => { start(); showAll(); Snd.clack(); } }, T('Reset to suggested'));
      const confirm = h('button', { class: 'btn primary block big' });
      const exact = tot => (free ? tot > 0 && tot <= max : tot === o.target);
      const update = () => {
        const tot = Core.mixTotal(counts, colours);
        const ok = exact(tot);
        const parts = colours.filter(col => counts[col.id]).map(col => U.fmtChips(counts[col.id] * col.chips));
        sumEl.textContent = (parts.length ? parts.join(' + ') : '0') + ' = ' + U.fmtChips(tot);
        totalEl.textContent = free ? T('Total {n} chips', { n: U.fmtChips(tot) }) : U.fmtChips(tot) + ' / ' + U.fmtChips(o.target) + (ok ? ' ✓' : '');
        totalEl.classList.toggle('ok', ok);
        totalEl.classList.toggle('bad-text', !ok && !free);
        hint.textContent = free ? '' : ok ? T('Change any count; the other colours rebalance.')
          : T('The other colours can’t make up the rest. Change another colour.');
        reset.style.display = !free && pinned.size ? '' : 'none';
        confirm.disabled = !ok;
        confirm.textContent = ok ? T('Confirm {m}', { m: T('{n} chips', { n: U.fmtChips(tot) }) }) : free ? (tot > max ? T('Over the chip leader ({n} max)', { n: U.fmtChips(max) }) : T('Add some chips')) : (tot > o.target ? T('{n} too many', { n: U.fmtChips(tot - o.target) }) : T('{n} to go', { n: U.fmtChips(o.target - tot) }));
      };
      confirm.addEventListener('click', () => {
        const tot = Core.mixTotal(counts, colours);
        if (!exact(tot)) return;
        api.close();
        o.onConfirm(tot, Object.assign({}, counts));
      });

      const shows = [];
      const showAll = () => { shows.forEach(f => f()); update(); };
      /* the host set colour `id` to n: pin it and let the rest follow */
      const setCount = (id, n) => {
        counts[id] = Math.max(0, n);
        if (!free) { pinned.add(id); rebalance(); }
        showAll();
      };
      const rows = colours.map(col => {
        const n = h('input', {
          type: 'text', inputMode: 'numeric', class: 'count-input', 'aria-label': col.name,
          onfocus: () => n.select(),
          oninput: () => { const v = Core.parseInt0(n.value); if (v != null) setCount(col.id, v); },
          onblur: () => { n.value = String(counts[col.id]); },
          onkeydown: e => { if (e.key === 'Enter') n.blur(); },
        });
        const math = h('span', { class: 'handout-math' });
        const left = h('small', { class: 'muted' });
        const row = h('div', { class: 'handout-row' });
        shows.push(() => {
          if (document.activeElement !== n) n.value = String(counts[col.id]);
          math.textContent = counts[col.id] + ' × ' + U.fmtChips(col.chips) + ' = ' + U.fmtChips(counts[col.id] * col.chips);
          row.classList.toggle('pinned', pinned.has(col.id));
          row.classList.toggle('zero', !counts[col.id]);
          if (bank[col.id] == null) return;
          const l = bank[col.id] - counts[col.id];
          left.textContent = T('{n} left in bank', { n: l });
          left.className = l < 0 ? 'bad-text' : 'muted';
        });
        const bump = d => {
          setCount(col.id, counts[col.id] + d);
          n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
          Snd.clack();
        };
        return U.append(row, [
          h('span', { class: 'swatch lg', style: { background: col.color } }),
          h('span', { class: 'grow col' }, h('strong', null, col.name), math, left),
          h('button', { class: 'round-btn', 'aria-label': '−', onclick: () => bump(-1) }, '−'), n,
          h('button', { class: 'round-btn', 'aria-label': '+', onclick: () => bump(1) }, '+')]);
      });
      showAll();

      return h('div', { class: 'handout' },
        h('div', { class: 'handout-head' },
          h('div', { class: 'row between' },
            h('h3', null, o.title),
            h('button', { class: 'btn ghost small', onclick: () => api.close() }, T('Cancel'))),
          free ? h('div', { class: 'muted' }, T('Build by colours: hand out any chips, the total becomes the buy-in.'))
            : h('div', { class: 'handout-target' }, T('{n} chips', { n: U.fmtChips(o.target) })),
          impossible && !free ? h('div', { class: 'warn' }, T('{n} chips can’t be made exactly with your colours.', { n: U.fmtChips(o.target) })) : null,
          sugg.short && !free ? h('div', { class: 'warn small' }, T('The bank is short of some colours, so this mix ignores the bank counts.')) : null),
        h('div', { class: 'handout-body' }, rows),
        h('div', { class: 'handout-foot' },
          sumEl, totalEl, hint, reset, confirm,
          fixed ? null : h('button', { class: 'btn ghost small', onclick: () => { free = !free; if (!free) start(); api.refresh(); } }, free ? T('Back to the target amount') : T('Build by colours (free mode)'))));
    }, { cls: 'full' });
  };
})();
