(function attachDesktopClock() {
  var clock = document.getElementById('desktopClock');
  if (!clock) {
    return;
  }

  function renderTime() {
    var now = new Date();
    clock.textContent = now.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  renderTime();
  setInterval(renderTime, 1000);
})();

(function desktopWindows() {
  var WINDOW_MARGIN = 12;
  var MIN_READABLE_WIDTH = 920;
  var MIN_READABLE_HEIGHT = 520;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isDesktop() {
    return window.matchMedia('(min-width: 1024px)').matches;
  }

  function exportTableAsCSV(rootNode, filePrefix) {
    var table = rootNode.querySelector('[data-table-filter-root]');
    if (!table) {
      return;
    }

    var csv = [];
    var headers = [];

    table.querySelectorAll('thead th').forEach(function (th) {
      headers.push(th.textContent.trim());
    });
    csv.push(headers.join(','));

    table.querySelectorAll('tbody tr').forEach(function (tr) {
      if (tr.classList.contains('data-row')) {
        var row = [];
        tr.querySelectorAll('td').forEach(function (td) {
          row.push('"' + td.textContent.trim().replace(/"/g, '""') + '"');
        });
        csv.push(row.join(','));
      }
    });

    var csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv.join('\n'));
    var link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', filePrefix + '_' + new Date().toISOString().split('T')[0] + '.csv');
    link.click();
  }

  function selectAllRows(rootNode, selected) {
    var rows = rootNode.querySelectorAll('.data-row');
    rows.forEach(function (row) {
      row.style.backgroundColor = selected ? 'rgba(193, 84, 27, 0.1)' : '';
    });
  }

  function initWindow(config) {
    var layer = document.getElementById(config.layerId);
    var frame = document.getElementById(config.frameId);
    var menu = document.getElementById(config.menuId);
    var floatingWindow = layer ? layer.querySelector('.desktop-floating-window') : null;
    var titlebar = layer ? layer.querySelector('.desktop-floating-window-titlebar') : null;
    var resizeHandle = layer ? layer.querySelector('[data-window-resize-handle]') : null;
    var currentUrl = '';

    if (!layer || !frame || !floatingWindow || !titlebar || !resizeHandle) {
      return;
    }

    var drag = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originLeft: 0,
      originTop: 0,
      nextLeft: 0,
      nextTop: 0,
      rafPending: false
    };

    var resize = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      startLeft: 0,
      startTop: 0,
      nextWidth: 0,
      nextHeight: 0,
      rafPending: false
    };

    function resetWindowPosition() {
      floatingWindow.style.width = '';
      floatingWindow.style.height = '';
      floatingWindow.style.left = '50%';
      floatingWindow.style.top = '72px';
      floatingWindow.style.transform = 'translateX(-50%)';
    }

    function materializeWindowPosition() {
      if (floatingWindow.style.transform === 'none') {
        return;
      }

      var rect = floatingWindow.getBoundingClientRect();
      floatingWindow.style.left = rect.left + 'px';
      floatingWindow.style.top = rect.top + 'px';
      floatingWindow.style.transform = 'none';
    }

    function getMinReadableSize() {
      return {
        width: Math.min(MIN_READABLE_WIDTH, Math.max(700, window.innerWidth - WINDOW_MARGIN * 2)),
        height: Math.min(MIN_READABLE_HEIGHT, Math.max(420, window.innerHeight - WINDOW_MARGIN * 2))
      };
    }

    function applyDragPosition() {
      if (!drag.active) {
        drag.rafPending = false;
        return;
      }

      floatingWindow.style.left = drag.nextLeft + 'px';
      floatingWindow.style.top = drag.nextTop + 'px';
      floatingWindow.style.transform = 'none';
      drag.rafPending = false;
    }

    function queueDragRender() {
      if (drag.rafPending) {
        return;
      }
      drag.rafPending = true;
      window.requestAnimationFrame(applyDragPosition);
    }

    function onPointerMove(event) {
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }

      var deltaX = event.clientX - drag.startX;
      var deltaY = event.clientY - drag.startY;

      var maxLeft = window.innerWidth - floatingWindow.offsetWidth - 12;
      var maxTop = window.innerHeight - floatingWindow.offsetHeight - 12;

      drag.nextLeft = clamp(drag.originLeft + deltaX, 12, Math.max(12, maxLeft));
      drag.nextTop = clamp(drag.originTop + deltaY, 12, Math.max(12, maxTop));
      queueDragRender();
    }

    function stopDrag() {
      if (drag.pointerId !== null && titlebar.hasPointerCapture(drag.pointerId)) {
        titlebar.releasePointerCapture(drag.pointerId);
      }

      drag.active = false;
      drag.pointerId = null;
      drag.rafPending = false;
      document.body.classList.remove('desktop-window-dragging');
    }

    function applyResizeDimensions() {
      if (!resize.active) {
        resize.rafPending = false;
        return;
      }

      floatingWindow.style.width = resize.nextWidth + 'px';
      floatingWindow.style.height = resize.nextHeight + 'px';

      resize.rafPending = false;
    }

    function queueResizeRender() {
      if (resize.rafPending) {
        return;
      }
      resize.rafPending = true;
      window.requestAnimationFrame(applyResizeDimensions);
    }

    function onResizePointerMove(event) {
      if (!resize.active || resize.pointerId !== event.pointerId) {
        return;
      }

      var minSize = getMinReadableSize();
      var maxWidth = window.innerWidth - resize.startLeft - WINDOW_MARGIN;
      var maxHeight = window.innerHeight - resize.startTop - WINDOW_MARGIN;

      var minWidth = Math.min(minSize.width, Math.max(320, maxWidth));
      var minHeight = Math.min(minSize.height, Math.max(280, maxHeight));

      var deltaX = event.clientX - resize.startX;
      var deltaY = event.clientY - resize.startY;

      resize.nextWidth = clamp(resize.startWidth + deltaX, minWidth, Math.max(minWidth, maxWidth));
      resize.nextHeight = clamp(resize.startHeight + deltaY, minHeight, Math.max(minHeight, maxHeight));

      queueResizeRender();
    }

    function stopResize() {
      if (resize.pointerId !== null && resizeHandle.hasPointerCapture(resize.pointerId)) {
        resizeHandle.releasePointerCapture(resize.pointerId);
      }

      resize.active = false;
      resize.pointerId = null;
      resize.rafPending = false;
      document.body.classList.remove('desktop-window-resizing');
    }

    function clearInteractionLocks() {
      if (drag.active || resize.active) {
        return;
      }

      document.body.classList.remove('desktop-window-dragging');
      document.body.classList.remove('desktop-window-resizing');
    }

    function renderLoading() {
      frame.innerHTML = '<div class="window-inline-state">A carregar...</div>';
    }

    function renderError(message) {
      frame.innerHTML = '<div class="window-inline-state is-error">' + String(message || 'Falha ao carregar conteudo.') + '</div>';
    }

    function getInlineScopeRoot() {
      return frame.querySelector('[data-mapas-table-filter-scope]') || frame;
    }

    function loadInlineContent(url) {
      currentUrl = String(url || '').trim();
      if (!currentUrl) {
        renderError('URL invalido.');
        return;
      }

      renderLoading();

      fetch(currentUrl, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          return response.text();
        })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var scope = doc.querySelector('[data-mapas-table-filter-scope]');
          if (!scope) {
            throw new Error('Conteudo inline nao encontrado');
          }

          frame.innerHTML = '';
          frame.appendChild(scope);

          if (typeof window.initMapasTableFilters === 'function') {
            window.initMapasTableFilters(scope);
          }
        })
        .catch(function (err) {
          console.error('Inline window load error:', err);
          renderError('Nao foi possivel carregar a listagem.');
        });
    }

    function openWindow(url) {
      resetWindowPosition();
      loadInlineContent(url);
      layer.hidden = false;
      document.body.classList.add('desktop-window-open');
    }

    function closeWindow() {
      stopDrag();
      stopResize();
      layer.hidden = true;
      frame.innerHTML = '';
      currentUrl = '';
      document.body.classList.remove('desktop-window-open');
    }

    document.querySelectorAll(config.openSelector).forEach(function (link) {
      link.addEventListener('click', function (event) {
        if (!isDesktop()) {
          return;
        }
        event.preventDefault();
        openWindow(link.getAttribute('href'));
      });
    });

    document.querySelectorAll('[data-close-window="' + config.windowId + '"]').forEach(function (el) {
      el.addEventListener('click', closeWindow);
    });

    titlebar.addEventListener('pointerdown', function (event) {
      if (resize.active) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      if (event.target && event.target.closest('.desktop-floating-window-close')) {
        return;
      }

      drag.active = true;
      drag.pointerId = event.pointerId;
      drag.startX = event.clientX;
      drag.startY = event.clientY;

      var rect = floatingWindow.getBoundingClientRect();
      drag.originLeft = rect.left;
      drag.originTop = rect.top;
      drag.nextLeft = rect.left;
      drag.nextTop = rect.top;

      document.body.classList.add('desktop-window-dragging');
      titlebar.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    titlebar.addEventListener('pointermove', onPointerMove);
    titlebar.addEventListener('pointerup', stopDrag);
    titlebar.addEventListener('pointercancel', stopDrag);
    titlebar.addEventListener('lostpointercapture', stopDrag);
    window.addEventListener('pointerup', stopDrag, true);
    window.addEventListener('pointercancel', stopDrag, true);
    window.addEventListener('blur', stopDrag);
    window.addEventListener('focus', clearInteractionLocks);

    resizeHandle.addEventListener('pointerdown', function (event) {
      if (drag.active || event.button !== 0) {
        return;
      }

      materializeWindowPosition();

      var rect = floatingWindow.getBoundingClientRect();
      resize.active = true;
      resize.pointerId = event.pointerId;
      resize.startX = event.clientX;
      resize.startY = event.clientY;
      resize.startWidth = rect.width;
      resize.startHeight = rect.height;
      resize.startLeft = rect.left;
      resize.startTop = rect.top;
      resize.nextWidth = rect.width;
      resize.nextHeight = rect.height;

      document.body.classList.add('desktop-window-resizing');
      resizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    resizeHandle.addEventListener('pointermove', onResizePointerMove);
    resizeHandle.addEventListener('pointerup', stopResize);
    resizeHandle.addEventListener('pointercancel', stopResize);
    resizeHandle.addEventListener('lostpointercapture', stopResize);
    window.addEventListener('pointerup', stopResize, true);
    window.addEventListener('pointercancel', stopResize, true);
    window.addEventListener('blur', stopResize);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        clearInteractionLocks();
      }
    });

    if (!menu) {
      return;
    }

    var menuItems = menu.querySelectorAll('.window-menu-item');
    var menuOptions = menu.querySelectorAll('.window-menu-option');

    menuItems.forEach(function (item) {
      var trigger = item.querySelector('.window-menu-trigger');
      if (trigger) {
        trigger.addEventListener('click', function (event) {
          event.preventDefault();
          var wasOpen = item.classList.contains('is-open');

          menuItems.forEach(function (m) {
            m.classList.remove('is-open');
          });

          if (!wasOpen) {
            item.classList.add('is-open');
          }
        });
      }
    });

    menuOptions.forEach(function (option) {
      option.addEventListener('click', function (event) {
        event.preventDefault();
        var action = option.getAttribute('data-action');

        menuItems.forEach(function (item) {
          item.classList.remove('is-open');
        });

        try {
          var rootNode = getInlineScopeRoot();
          if (!rootNode) {
            return;
          }

          switch (action) {
            case 'export-csv':
              exportTableAsCSV(rootNode, config.filePrefix);
              break;
            case 'export-excel':
              alert('Exportar Excel ainda não implementado');
              break;
            case 'print':
              window.print();
              break;
            case 'refresh':
              loadInlineContent(currentUrl);
              break;
            case 'reset-filters':
              var clearButton = rootNode.querySelector('[data-table-filter-clear-all]');
              if (clearButton) {
                clearButton.click();
              }
              break;
            case 'select-all':
              selectAllRows(rootNode, true);
              break;
            case 'select-none':
              selectAllRows(rootNode, false);
              break;
            default:
              break;
          }
        } catch (err) {
          console.error('Menu action error:', err);
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('#' + config.menuId)) {
        menuItems.forEach(function (item) {
          item.classList.remove('is-open');
        });
      }
    });
  }

  initWindow({
    windowId: 'diario',
    layerId: 'diarioDesktopLayer',
    frameId: 'diarioDesktopFrame',
    menuId: 'windowMenu',
    openSelector: '[data-open-diario-window="1"]',
    filePrefix: 'diario_caixa'
  });

  initWindow({
    windowId: 'auditoria',
    layerId: 'auditoriaDesktopLayer',
    frameId: 'auditoriaDesktopFrame',
    menuId: 'windowMenuAuditoria',
    openSelector: '[data-open-auditoria-window="1"]',
    filePrefix: 'auditoria_logs'
  });
})();
