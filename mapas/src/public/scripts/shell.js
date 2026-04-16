(function () {
  try {
    if (window.self !== window.top) {
      document.body.classList.add('in-desktop-iframe');
    }
  } catch (err) {
    // Ignore frame access restrictions if any.
  }

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
        createdAtDate: (r) => ((r.cells[0]?.textContent || '').trim().slice(0, 10)),
        tableName: (r) => (r.cells[1]?.textContent || '').trim(),
        recordId: (r) => (r.cells[2]?.textContent || '').trim().toLowerCase(),
        action: (r) => (r.cells[3]?.textContent || '').trim(),
        userId: (r) => (r.cells[4]?.textContent || '').trim().toLowerCase()
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

  function updateToggleStates(root, cfg, state, form) {
    const sortBy = String(form.elements.namedItem('sortBy')?.value || '').trim();
    const sortDir = String(form.elements.namedItem('sortDir')?.value || '').trim().toUpperCase();

    root.querySelectorAll('[data-table-filter-toggle]').forEach((button) => {
      const key = button.getAttribute('data-table-filter-toggle');
      const th = button.closest('th[data-table-filter-key]');
      const filtered = state.has(key);
      const sorted = (cfg.sortMap[key] || '') === sortBy && (sortDir === 'ASC' || sortDir === 'DESC');
      const glyph = sorted ? (sortDir === 'ASC' ? 'A↑' : 'D↓') : (filtered ? '•' : '▽');

      button.setAttribute('data-sort-glyph', glyph);
      button.classList.toggle('is-filtered', filtered);
      button.classList.toggle('is-sorted', sorted);

      if (th) {
        th.classList.toggle('is-filtered', filtered);
        th.classList.toggle('is-sorted', sorted);
      }
    });
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
      const safeValue = v.replace(/"/g, '&quot;');
      const safeLabel = v.replace(/"/g, '&quot;').toLowerCase();
      return `<label class="tf-option" data-option-row data-label="${safeLabel}"><input type="checkbox" data-v="${safeValue}" ${checked ? 'checked' : ''}/> <span>${v}</span></label>`;
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
      <div class="tf-actions">
        <button type="button" data-apply>Aplicar</button>
      </div>
      <input type="text" class="tf-search" data-search placeholder="Filtrar valores..." />
      <div class="tf-options">
        <label class="tf-option tf-all"><input type="checkbox" data-all ${allChecked ? 'checked' : ''}/> <span data-all-label>Todos</span></label>
        ${list || '<div class="tf-empty">Sem opções</div>'}
      </div>
    `;

    const all = menu.querySelector('[data-all]');
    const allLabel = menu.querySelector('[data-all-label]');
    const search = menu.querySelector('[data-search]');
    const cbs = Array.from(menu.querySelectorAll('input[data-v]'));
    let forceExplicitSelection = false;

    function refreshAllState() {
      if (!all) return;
      const checkedCount = cbs.filter((c) => c.checked).length;

      if (checkedCount === 0) {
        all.checked = !forceExplicitSelection;
        all.indeterminate = false;
        if (allLabel) allLabel.textContent = forceExplicitSelection ? 'Todos (0)' : 'Todos';
        return;
      }

      if (checkedCount === cbs.length) {
        all.checked = false;
        all.indeterminate = false;
        if (allLabel) allLabel.textContent = `Todos (${checkedCount})`;
        return;
      }

      all.checked = false;
      all.indeterminate = true;
      if (allLabel) allLabel.textContent = `Todos (${checkedCount})`;
    }

    function normalizeForSearch(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    function applySearchFilter() {
      if (!search) return;
      const q = normalizeForSearch(search.value);

      if (q.length > 0) {
        forceExplicitSelection = true;
        if (all) {
          all.checked = false;
          all.indeterminate = false;
        }
      }

      cbs.forEach((cb) => {
        const row = cb.closest('[data-option-row]');
        const labelRaw = row ? row.getAttribute('data-label') : '';
        const label = normalizeForSearch(labelRaw);
        if (!row) return;
        row.style.display = q && !label.includes(q) ? 'none' : '';
      });

      refreshAllState();
    }

    if (all) {
      all.addEventListener('change', () => {
        if (all.checked) {
          forceExplicitSelection = false;
          state.delete(key);
          cbs.forEach((c) => { c.checked = false; });
          refreshAllState();
        }
      });
    }

    cbs.forEach((cb) => {
      cb.addEventListener('change', () => {
        refreshAllState();
      });
    });

    if (search) {
      search.addEventListener('input', applySearchFilter);
    }

    refreshAllState();

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
      updateToggleStates(root, cfg, state, form);
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function positionMenuWithinListing(root, button) {
    const anchorRect = button.getBoundingClientRect();
    const listing = root.querySelector('.table-wrap') || root;
    const listingRect = listing.getBoundingClientRect();
    const horizontalPadding = 8;

    menu.style.position = 'fixed';
    menu.style.maxWidth = `${Math.max(240, Math.floor(listingRect.width - horizontalPadding * 2))}px`;
    menu.hidden = false;

    const menuRect = menu.getBoundingClientRect();
    const minLeft = listingRect.left + horizontalPadding;
    const maxLeft = listingRect.right - horizontalPadding - menuRect.width;
    const resolvedLeft = clamp(anchorRect.left, minLeft, Math.max(minLeft, maxLeft));

    menu.style.left = `${Math.round(resolvedLeft)}px`;
    menu.style.top = `${Math.min(window.innerHeight - 16 - 340, anchorRect.bottom + 6)}px`;
  }

  function initScope(root) {
    const scopeName = getScope(root);
    const cfg = CONFIG[scopeName];
    if (!cfg) return;

    const form = root.querySelector('[data-grid-form]');
    if (!form) return;

    const state = readState(form, cfg);
    const options = parseOptions(root);
    updateToggleStates(root, cfg, state, form);

    root.querySelectorAll('[data-table-filter-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-table-filter-toggle');
        if (!key) return;

        ensureMenu();
        openCtx = { root, form, cfg, key, state, options, button };
        renderMenu(openCtx);

        positionMenuWithinListing(root, button);
        button.setAttribute('aria-expanded', 'true');
      });
    });

    root.querySelector('[data-table-filter-clear-all]')?.addEventListener('click', () => {
      state.clear();
      syncHiddenInputs(form, state, cfg);
      updateToggleStates(root, cfg, state, form);
      submitForm(form);
    });

    const anoPicker = root.querySelector('[data-ano-picker]');
    const anoInput = form.querySelector('[data-ano-input]');
    if (anoPicker && anoInput) {
      anoPicker.addEventListener('change', () => {
        const val = parseInt(anoPicker.value, 10);
        if (Number.isFinite(val) && val >= 2000 && val <= 2100) {
          anoInput.value = val;
          form.querySelector('[data-page-input]').value = '1';
          submitForm(form);
        }
      });
    }

    const periodPicker = root.querySelector('[data-period-picker]');
    const periodInput = form.querySelector('[data-period-input]');
    if (periodPicker && periodInput) {
      periodPicker.addEventListener('change', () => {
        const val = String(periodPicker.value || '').trim();
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(val)) {
          periodInput.value = val;
          form.querySelector('[data-page-input]').value = '1';
          submitForm(form);
        }
      });
    }

    root.querySelectorAll('[data-page-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetPage = parseInt(button.getAttribute('data-page-nav') || '', 10);
        const pageInput = form.querySelector('[data-page-input]');
        if (!Number.isFinite(targetPage) || !pageInput) {
          return;
        }
        pageInput.value = String(Math.max(1, targetPage));
        submitForm(form);
      });
    });

    if (scopeName === 'auditoriaLogs') {
      const payloadPanels = Array.from(root.querySelectorAll('details.payload-collapse'));
      payloadPanels.forEach((panel) => {
        panel.addEventListener('toggle', () => {
          if (!panel.open) {
            return;
          }
          payloadPanels.forEach((other) => {
            if (other !== panel) {
              other.open = false;
            }
          });
        });
      });
    }
  }

  function initMapasTableFilters(root) {
    if (root && root.nodeType === 1) {
      if (root.hasAttribute('data-mapas-table-filter-scope')) {
        initScope(root);
        return;
      }

      root.querySelectorAll('[data-mapas-table-filter-scope]').forEach(initScope);
      return;
    }

    document.querySelectorAll('[data-mapas-table-filter-scope]').forEach(initScope);
  }

  window.initMapasTableFilters = initMapasTableFilters;
  initMapasTableFilters(document);
})();
