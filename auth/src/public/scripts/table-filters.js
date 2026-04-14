/**
 * Table Filter System for Auth Users List
 * Similar to mapas implementation but adapted for users table
 */
(function () {
  const EMPTY = '__EMPTY__';
  const CONFIG = {
    users: {
      columns: ['userName', 'fullName', 'email', 'role', 'isAuthorized'],
      sortMap: {
        userName: 'userName',
        fullName: 'fullName',
        email: 'email',
        role: 'role',
        isAuthorized: 'isAuthorized'
      },
      extractor: {
        userName: (r) => (r.cells[0]?.textContent || '').trim(),
        fullName: (r) => (r.cells[1]?.textContent || '').trim(),
        email: (r) => (r.cells[2]?.textContent || '').trim(),
        role: (r) => (r.cells[3]?.textContent || '').trim(),
        isAuthorized: (r) => (r.cells[4]?.textContent || '').trim()
      }
    }
  };

  let menu = null;
  let openCtx = null;

  function paramName(key) {
    return `tf${key[0].toUpperCase()}${key.slice(1)}`;
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
    const { key, state, options, cfg, root, form, label } = ctx;
    const hasExplicitFilter = state.has(key);
    const selected = state.get(key) || new Set();
    const available = Array.isArray(options[key]) ? options[key].map((o) => String(o).trim()).filter(Boolean) : [];
    const unique = Array.from(new Set(available)).sort((a, b) => {
      // For boolean-like values, sort differently
      if (key === 'isAuthorized') {
        return a === 'true' ? -1 : 1;
      }
      return a.localeCompare(b, 'pt-PT');
    });

    const allChecked = !hasExplicitFilter;
    const list = unique.map((v) => {
      const checked = !hasExplicitFilter || selected.has(v);
      const safeValue = v.replace(/"/g, '&quot;');
      const displayValue = key === 'isAuthorized' ? (v === 'true' ? 'Sim' : 'Não') : v;
      const safeLabel = displayValue.replace(/"/g, '&quot;').toLowerCase();
      return `<label class="tf-option" data-option-row data-label="${safeLabel}"><input type="checkbox" data-v="${safeValue}" ${checked ? 'checked' : ''}/> <span>${displayValue}</span></label>`;
    }).join('');

    menu.innerHTML = `
      <div class="tf-menu-head">
        <strong>${label || key}</strong>
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
    let currentSearchQuery = '';

    function isVisibleOption(cb) {
      const row = cb.closest('[data-option-row]');
      return !row || row.style.display !== 'none';
    }

    function refreshAllState() {
      if (!all) return;
      const scope = currentSearchQuery ? cbs.filter((c) => isVisibleOption(c)) : cbs;
      const checkedCount = scope.filter((c) => c.checked).length;
      const searching = Boolean(currentSearchQuery);

      function setAllLabel(text) {
        if (allLabel) allLabel.textContent = text;
      }

      function labelForSearch(checked, total) {
        if (checked === total) return `Todos visiveis (${total})`;
        return `Todos visiveis (${checked}/${total})`;
      }

      if (scope.length === 0) {
        all.checked = false;
        all.indeterminate = false;
        setAllLabel(searching ? 'Todos visiveis (0)' : 'Todos (0)');
        return;
      }

      if (checkedCount === scope.length) {
        all.checked = true;
        all.indeterminate = false;
        setAllLabel(searching ? labelForSearch(checkedCount, scope.length) : `Todos (${checkedCount})`);
        return;
      }

      if (checkedCount === 0) {
        all.checked = false;
        all.indeterminate = false;
        setAllLabel(searching ? labelForSearch(0, scope.length) : 'Todos');
        return;
      }

      all.checked = false;
      all.indeterminate = true;
      setAllLabel(searching ? labelForSearch(checkedCount, scope.length) : `Todos (${checkedCount})`);
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
      currentSearchQuery = q;

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
          if (currentSearchQuery) {
            cbs.forEach((c) => { c.checked = isVisibleOption(c); });
          } else {
            cbs.forEach((c) => { c.checked = true; });
          }
        } else {
          if (currentSearchQuery) {
            cbs.forEach((c) => {
              if (isVisibleOption(c)) c.checked = false;
            });
          } else {
            cbs.forEach((c) => { c.checked = false; });
          }
        }
        refreshAllState();
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
        form.querySelector('[data-page-input]').value = '1';
        submitForm(form);
      });
    });

    menu.querySelector('[data-apply]')?.addEventListener('click', () => {
      const allValuesChecked = cbs.length > 0 && cbs.every((c) => c.checked);
      if (all && all.checked && !currentSearchQuery && allValuesChecked) {
        state.delete(key);
      } else {
        const selectedSource = currentSearchQuery
          ? cbs.filter((c) => isVisibleOption(c) && c.checked)
          : cbs.filter((c) => c.checked);
        const selectedVals = new Set(selectedSource.map((c) => c.getAttribute('data-v') || ''));
        if (!selectedVals.size) {
          state.set(key, new Set());
        } else {
          state.set(key, selectedVals);
        }
      }

      syncHiddenInputs(form, state, cfg);
      updateToggleStates(root, cfg, state, form);
      form.querySelector('[data-page-input]').value = '1';
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

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !menu.hidden) {
        closeMenu(false);
      }
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

  function initUsersListMenu(root, form, state, cfg) {
    const windowRoot = root.closest('.desktop-window');
    const menuRoot = (windowRoot && windowRoot.querySelector('[data-users-list-menu]')) || root.querySelector('[data-users-list-menu]');
    if (!menuRoot) {
      return;
    }

    const menuItems = Array.from(menuRoot.querySelectorAll('.window-menu-item'));

    function closeAll() {
      menuItems.forEach((item) => item.classList.remove('is-open'));
    }

    menuRoot.querySelectorAll('.window-menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const item = trigger.closest('.window-menu-item');
        const willOpen = !item.classList.contains('is-open');
        closeAll();
        if (willOpen) {
          item.classList.add('is-open');
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!menuRoot.contains(event.target)) {
        closeAll();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAll();
      }
    });

    menuRoot.querySelectorAll('[data-menu-action]').forEach((option) => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        const action = option.getAttribute('data-menu-action');
        const pageInput = form.querySelector('[data-page-input]');
        const sortByInput = form.elements.namedItem('sortBy');
        const sortDirInput = form.elements.namedItem('sortDir');

        function exportFiltered(format) {
          const actionUrl = String(form.getAttribute('action') || window.location.pathname || '').replace(/\/$/, '');
          const exportBase = `${actionUrl}/users/export`;
          const params = new URLSearchParams();

          Array.from(new FormData(form).entries()).forEach(([name, value]) => {
            if (name === 'openWindow' || name === 'page' || name === 'pageSize') return;
            if (name === 'sortBy' || name === 'sortDir' || /^tf[A-Z]/.test(name)) {
              params.append(name, String(value || ''));
            }
          });

          params.set('format', format);
          window.location.assign(`${exportBase}?${params.toString()}`);
        }

        if (action === 'refresh') {
          closeAll();
          submitForm(form);
          return;
        }

        if (action === 'first-page') {
          if (pageInput) {
            pageInput.value = '1';
          }
          closeAll();
          submitForm(form);
          return;
        }

        if (action === 'clear-filters') {
          state.clear();
          syncHiddenInputs(form, state, cfg);
          updateToggleStates(root, cfg, state, form);
          if (pageInput) {
            pageInput.value = '1';
          }
          closeAll();
          submitForm(form);
          return;
        }

        if (action === 'export-csv') {
          closeAll();
          exportFiltered('csv');
          return;
        }

        if (action === 'export-odf') {
          closeAll();
          exportFiltered('odf');
          return;
        }

        if (action === 'sort') {
          const sortBy = option.getAttribute('data-sort-by') || '';
          const sortDir = option.getAttribute('data-sort-dir') || 'ASC';
          if (sortByInput) {
            sortByInput.value = sortBy;
          }
          if (sortDirInput) {
            sortDirInput.value = sortDir;
          }
          if (pageInput) {
            pageInput.value = '1';
          }
          closeAll();
          submitForm(form);
        }
      });
    });
  }

  function initScope(root) {
    const cfg = CONFIG.users;
    if (!cfg) return;

    const form = root.querySelector('[data-grid-form]');
    if (!form) return;

    const state = readState(form, cfg);
    const options = parseOptions(root);
    updateToggleStates(root, cfg, state, form);
    initUsersListMenu(root, form, state, cfg);

    root.querySelectorAll('[data-table-filter-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.getAttribute('data-table-filter-toggle');
        if (!key) return;

        const th = button.closest('th[data-table-filter-key]');
        const headerLabel = (th && th.querySelector('.table-filter-head span'))
          ? String(th.querySelector('.table-filter-head span').textContent || '').trim()
          : key;

        ensureMenu();
        openCtx = { root, form, cfg, key, state, options, button, label: headerLabel };
        renderMenu(openCtx);

        positionMenuWithinListing(root, button);
        button.setAttribute('aria-expanded', 'true');
      });
    });

    root.querySelector('[data-table-filter-clear-all]')?.addEventListener('click', () => {
      state.clear();
      syncHiddenInputs(form, state, cfg);
      updateToggleStates(root, cfg, state, form);
      form.querySelector('[data-page-input]').value = '1';
      submitForm(form);
    });

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
  }

  // Init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.querySelector('[data-table-filter-root]');
      if (root) initScope(root.closest('.users-list-wrap') || root);
    });
  } else {
    const root = document.querySelector('[data-table-filter-root]');
    if (root) initScope(root.closest('.users-list-wrap') || root);
  }
})();
