(function () {
  const EMPTY = '__EMPTY__';
  const CONFIG = {
    diarioCaixa: {
      columns: ['data', 'codigoEntidade', 'docEntidade', 'codigoTipo', 'centroCustos', 'mapa', 'creditoDebito', 'conta'],
      sortMap: {
        data: 'data',
        codigoEntidade: 'codigoEntidade',
        docEntidade: 'docEntidade',
        codigoTipo: 'codigoTipo',
        centroCustos: 'centroCustos',
        mapa: 'mapa',
        creditoDebito: 'creditoDebito',
        conta: 'conta'
      },
      extractor: {
        data: (r) => (r.cells[0]?.textContent || '').trim(),
        codigoEntidade: (r) => (r.cells[1]?.textContent || '').trim(),
        docEntidade: (r) => (r.cells[2]?.textContent || '').trim(),
        codigoTipo: (r) => (r.cells[4]?.textContent || '').trim(),
        centroCustos: (r) => (r.cells[5]?.textContent || '').trim(),
        mapa: (r) => (r.cells[6]?.textContent || '').trim(),
        creditoDebito: (r) => (r.cells[8]?.textContent || '').trim(),
        conta: (r) => (r.cells[9]?.textContent || '').trim()
      }
    },
    auditoriaLogs: {
      columns: ['createdAtDate', 'tableName', 'recordId', 'action', 'userId'],
      sortMap: {
        createdAtDate: 'createdAt',
        tableName: 'tableName',
        recordId: 'recordId',
        action: 'action',
        userId: 'userId'
      },
      extractor: {
        createdAtDate: (r) => ((r.cells[1]?.textContent || '').trim().slice(0, 10)),
        tableName: (r) => (r.cells[2]?.textContent || '').trim(),
        recordId: (r) => (r.cells[3]?.textContent || '').trim().toLowerCase(),
        action: (r) => (r.cells[4]?.textContent || '').trim(),
        userId: (r) => (r.cells[5]?.textContent || '').trim().toLowerCase()
      }
    }
  };

  let menu = null;
  let openCtx = null;

  function paramName(key) {
    return `tf${key[0].toUpperCase()}${key.slice(1)}`;
  }

  function getScope(root) {
    return (root.getAttribute('data-mapas-table-filter-scope') || '').trim();
  }

  function parseOptions(root) {
    const script = root.querySelector('[data-table-filter-options-json]');
    if (!script) return {};
    try { return JSON.parse(script.textContent || '{}'); } catch (_) { return {}; }
  }

  function readState(form, cfg) {
    const state = new Map();
    cfg.columns.forEach((k) => {
      const field = form.elements.namedItem(paramName(k));
      if (!field) return;
      const values = typeof field.length === 'number' ? Array.from(field).map((i) => String(i.value || '').trim()) : [String(field.value || '').trim()];
      const normalized = values.filter(Boolean);
      if (!normalized.length) return;
      if (normalized.includes(EMPTY)) {
        state.set(k, new Set());
      } else {
        state.set(k, new Set(normalized));
      }
    });
    return state;
  }

  function syncHiddenInputs(form, state, cfg) {
    form.querySelectorAll('[data-table-filter-input]').forEach((i) => i.remove());
    cfg.columns.forEach((k) => {
      if (!state.has(k)) return;
      const values = Array.from(state.get(k) || []);
      const persisted = values.length ? values : [EMPTY];
      persisted.forEach((v) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = paramName(k);
        input.value = v;
        input.setAttribute('data-table-filter-input', '1');
        form.appendChild(input);
      });
    });
  }

  function applyLocalFilter(root, cfg, state) {
    const rows = Array.from(root.querySelectorAll('tbody tr.data-row'));
    rows.forEach((row) => {
      let visible = true;
      for (const k of cfg.columns) {
        if (!state.has(k)) continue;
        const selected = state.get(k);
        const cellVal = String(cfg.extractor[k](row) || '').trim();
        if (!selected.size) {
          if (cellVal !== '') visible = false;
        } else if (!selected.has(cellVal)) {
          visible = false;
        }
        if (!visible) break;
      }
      row.hidden = !visible;
    });

    const summary = root.querySelector('[data-table-filter-summary-text]');
    if (summary) {
      const total = rows.length;
      const shown = rows.filter((r) => !r.hidden).length;
      summary.innerHTML = `A mostrar <strong>${shown}</strong> de <strong>${total}</strong> registos nesta pagina.`;
    }
  }

  function submitForm(form) {
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.submit();
  }

  function closeMenu(submit) {
    if (!menu || !openCtx) return;
    menu.hidden = true;
    openCtx.button.setAttribute('aria-expanded', 'false');
    if (submit) submitForm(openCtx.form);
    openCtx = null;
  }

  function renderMenu(ctx) {
    const { key, state, options, cfg, root, form } = ctx;
    const selected = state.get(key) || new Set();
    const available = Array.isArray(options[key]) ? options[key].map((o) => String(o.value || '').trim()).filter(Boolean) : [];
    const unique = Array.from(new Set(available)).sort((a, b) => a.localeCompare(b, 'pt-PT'));

    const allChecked = !state.has(key);
    const list = unique.map((v) => {
      const checked = selected.has(v);
      return `<label class="tf-option"><input type="checkbox" data-v="${v.replace(/"/g, '&quot;')}" ${checked ? 'checked' : ''}/> <span>${v}</span></label>`;
    }).join('');

    menu.innerHTML = `
      <div class="tf-menu-head">
        <strong>${key}</strong>
        <button type="button" data-close>×</button>
      </div>
      <div class="tf-sort">
        <button type="button" data-sort="ASC">Ordenar A-Z</button>
        <button type="button" data-sort="DESC">Ordenar Z-A</button>
      </div>
      <label class="tf-option tf-all"><input type="checkbox" data-all ${allChecked ? 'checked' : ''}/> <span>Todos</span></label>
      <div class="tf-options">${list || '<div class="tf-empty">Sem opções</div>'}</div>
      <div class="tf-actions">
        <button type="button" data-apply>Aplicar</button>
      </div>
    `;

    const all = menu.querySelector('[data-all]');
    const cbs = Array.from(menu.querySelectorAll('input[data-v]'));

    if (all) {
      all.addEventListener('change', () => {
        if (all.checked) {
          state.delete(key);
          cbs.forEach((c) => { c.checked = false; });
        }
      });
    }

    cbs.forEach((cb) => {
      cb.addEventListener('change', () => {
        if (all) all.checked = false;
      });
    });

    menu.querySelectorAll('[data-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sortBy = form.elements.namedItem('sortBy');
        const sortDir = form.elements.namedItem('sortDir');
        if (sortBy) sortBy.value = cfg.sortMap[key] || '';
        if (sortDir) sortDir.value = btn.getAttribute('data-sort');
        submitForm(form);
      });
    });

    menu.querySelector('[data-apply]')?.addEventListener('click', () => {
      if (all && all.checked) {
        state.delete(key);
      } else {
        const selectedVals = new Set(cbs.filter((c) => c.checked).map((c) => c.getAttribute('data-v') || ''));
        if (!selectedVals.size) {
          state.set(key, new Set());
        } else {
          state.set(key, selectedVals);
        }
      }

      syncHiddenInputs(form, state, cfg);
      applyLocalFilter(root, cfg, state);
      closeMenu(true);
    });

    menu.querySelector('[data-close]')?.addEventListener('click', () => closeMenu(false));
  }

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'tf-menu';
    menu.hidden = true;
    document.body.appendChild(menu);

    document.addEventListener('click', (ev) => {
      if (!openCtx || menu.hidden) return;
      if (menu.contains(ev.target) || openCtx.button.contains(ev.target)) return;
      closeMenu(false);
    });

    return menu;
  }

  function initScope(root) {
    const scopeName = getScope(root);
    const cfg = CONFIG[scopeName];
    if (!cfg) return;

    const form = root.querySelector('[data-grid-form]');
    if (!form) return;

    const state = readState(form, cfg);
    const options = parseOptions(root);
    applyLocalFilter(root, cfg, state);

    root.querySelectorAll('[data-table-filter-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-table-filter-toggle');
        if (!key) return;

        ensureMenu();
        openCtx = { root, form, cfg, key, state, options, button };
        renderMenu(openCtx);

        const rect = button.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 300, rect.left))}px`;
        menu.style.top = `${Math.min(window.innerHeight - 16 - 340, rect.bottom + 6)}px`;
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
      });
    });

    root.querySelector('[data-table-filter-clear-all]')?.addEventListener('click', () => {
      state.clear();
      syncHiddenInputs(form, state, cfg);
      applyLocalFilter(root, cfg, state);
      submitForm(form);
    });
  }

  document.querySelectorAll('[data-mapas-table-filter-scope]').forEach(initScope);
})();
