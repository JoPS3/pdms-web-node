(function initStandaloneDesktopWindow() {
  function isDesktop() {
    return window.matchMedia('(min-width: 1024px)').matches;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function resetWindowPosition(windowEl) {
    windowEl.style.left = '50%';
    windowEl.style.top = '72px';
    windowEl.style.transform = 'translateX(-50%)';
  }

  function materializeWindowPosition(windowEl) {
    var rect = windowEl.getBoundingClientRect();
    windowEl.style.left = rect.left + 'px';
    windowEl.style.top = rect.top + 'px';
    windowEl.style.transform = 'none';
  }

  function initWindow(windowEl) {
    var titlebar = windowEl.querySelector('.desktop-window-titlebar');
    if (!titlebar) {
      return;
    }

    var dragState = {
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originLeft: 0,
      originTop: 0
    };

    resetWindowPosition(windowEl);

    function stopDrag() {
      if (!dragState.dragging) {
        return;
      }

      if (dragState.pointerId !== null && titlebar.hasPointerCapture(dragState.pointerId)) {
        titlebar.releasePointerCapture(dragState.pointerId);
      }

      dragState.dragging = false;
      dragState.pointerId = null;
      document.body.classList.remove('desktop-window-dragging');
    }

    titlebar.addEventListener('pointerdown', function (event) {
      if (!isDesktop() || event.button !== 0) {
        return;
      }

      if (event.target.closest('a, button, input, select, textarea, .desktop-window-traffic-light')) {
        return;
      }

      materializeWindowPosition(windowEl);
      var rect = windowEl.getBoundingClientRect();

      dragState.dragging = true;
      dragState.pointerId = event.pointerId;
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.originLeft = rect.left;
      dragState.originTop = rect.top;

      titlebar.setPointerCapture(event.pointerId);
      document.body.classList.add('desktop-window-dragging');
      event.preventDefault();
    });

    titlebar.addEventListener('pointermove', function (event) {
      if (!dragState.dragging || dragState.pointerId !== event.pointerId) {
        return;
      }

      var deltaX = event.clientX - dragState.startX;
      var deltaY = event.clientY - dragState.startY;
      var maxLeft = window.innerWidth - windowEl.offsetWidth - 12;
      var maxTop = window.innerHeight - windowEl.offsetHeight - 12;
      var nextLeft = clamp(dragState.originLeft + deltaX, 12, Math.max(12, maxLeft));
      var nextTop = clamp(dragState.originTop + deltaY, 12, Math.max(12, maxTop));

      windowEl.style.left = nextLeft + 'px';
      windowEl.style.top = nextTop + 'px';
      windowEl.style.transform = 'none';
    });

    titlebar.addEventListener('pointerup', stopDrag);
    titlebar.addEventListener('pointercancel', stopDrag);
    titlebar.addEventListener('lostpointercapture', stopDrag);

    window.addEventListener('blur', stopDrag);
    window.addEventListener('resize', function () {
      if (!isDesktop()) {
        stopDrag();
        return;
      }

      var rect = windowEl.getBoundingClientRect();
      var maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
      var maxTop = Math.max(12, window.innerHeight - rect.height - 12);
      if (windowEl.style.transform === 'translateX(-50%)') {
        return;
      }
      windowEl.style.left = clamp(rect.left, 12, maxLeft) + 'px';
      windowEl.style.top = clamp(rect.top, 12, maxTop) + 'px';
    });
  }

  function init() {
    if (!isDesktop()) {
      return;
    }

    document.body.classList.add('desktop-window-open');
    var windowEl = document.querySelector('[data-standalone-window="1"]');
    if (!windowEl) {
      return;
    }

    initWindow(windowEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
