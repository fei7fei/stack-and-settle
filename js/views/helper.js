/* Colour helper for handing out chips: suggested split, +/- per colour, confirm only when exact. */
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
    colours.forEach(col => { counts[col.id] = o.current ? (o.current[col.id] || 0) : impossible ? 0 : (sugg.mix[col.id] || 0); });
    U.sheet(api => {
      const totalEl = h('div', { class: 'helper-total' });
      const confirm = h('button', { class: 'btn primary block' });
      const update = () => {
        const tot = Core.mixTotal(counts, colours);
        const ok = free ? tot > 0 && tot <= max : tot === o.target;
        if (free) totalEl.textContent = T('Total {n} chips = {m}', { n: U.fmtChips(tot), m: Core.fmt(tot * c.cv, c.symbol) });
        else totalEl.textContent = U.fmtChips(tot) + ' / ' + U.fmtChips(o.target) + (ok ? ' ✓' : '');
        totalEl.classList.toggle('ok', ok);
        confirm.disabled = !ok;
        confirm.textContent = ok ? T('Confirm {m}', { m: Core.fmt(tot * c.cv, c.symbol) }) : free ? (tot > max ? T('Over the chip leader ({n} max)', { n: U.fmtChips(max) }) : T('Add some chips')) : (tot > o.target ? T('{n} too many', { n: U.fmtChips(tot - o.target) }) : T('{n} to go', { n: U.fmtChips(o.target - tot) }));
      };
      confirm.addEventListener('click', () => {
        const tot = Core.mixTotal(counts, colours);
        if (!(free ? tot > 0 && tot <= max : tot === o.target)) return;
        api.close();
        o.onConfirm(tot, Object.assign({}, counts));
      });
      const rows = colours.map(col => {
        const n = h('strong', { class: 'count-input', style: { border: 0, display: 'inline-block' } }, String(counts[col.id]));
        const sub = h('span', { class: 'muted small w-md', style: { textAlign: 'right' } });
        const left = h('small', { class: 'muted' });
        const show = () => {
          n.textContent = String(counts[col.id]); sub.textContent = U.fmtChips(counts[col.id] * col.chips);
          if (bank[col.id] == null) return;
          const l = bank[col.id] - counts[col.id];
          left.textContent = T('{n} left in bank', { n: l });
          left.className = l < 0 ? 'bad-text' : 'muted';
        };
        const bump = d => {
          counts[col.id] = Math.max(0, counts[col.id] + d);
          n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
          Snd.clack(); show(); update();
        };
        show();
        return h('div', { class: 'count-row' },
          h('span', { class: 'swatch', style: { background: col.color } }),
          h('span', { class: 'grow col' }, h('span', null, col.name, h('small', { class: 'muted' }, ' × ' + U.fmtChips(col.chips))), left),
          h('button', { class: 'round-btn', 'aria-label': '−', onclick: () => bump(-1) }, '−'), n,
          h('button', { class: 'round-btn', 'aria-label': '+', onclick: () => bump(1) }, '+'), sub);
      });
      update();
      return h('div', { class: 'stack' },
        h('h3', null, o.title),
        free ? h('div', { class: 'muted' }, T('Build by colours: hand out any chips, the total becomes the buy-in.'))
          : h('div', null, h('strong', null, Core.fmt(o.target * c.cv, c.symbol) + ' = ' + T('{n} chips', { n: U.fmtChips(o.target) })),
            !impossible ? h('div', { class: 'muted small' }, T('Suggested') + ': ' + Game.mixText(sugg.mix, colours)) : null),
        impossible && !free ? h('div', { class: 'warn' }, T('{n} chips can’t be made exactly with your colours.', { n: U.fmtChips(o.target) })) : null,
        sugg.short && !free ? h('div', { class: 'warn small' }, T('The bank is short of some colours, so this mix ignores the bank counts.')) : null,
        h('div', { class: 'stack-s' }, rows),
        totalEl, confirm,
        fixed ? null : h('button', { class: 'btn ghost small', onclick: () => { free = !free; api.refresh(); } }, free ? T('Back to the target amount') : T('Build by colours (free mode)')));
    });
  };
})();
