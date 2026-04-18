(function () {
  const VIEWPORT_MARGIN = 16;

  function parseSize(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function applyInitialSize(win) {
    const requestedWidth = parseSize(win.dataset.openWidth);
    const requestedHeight = parseSize(win.dataset.openHeight);
    const maxWidth = Math.max(240, window.innerWidth - (VIEWPORT_MARGIN * 2));
    const maxHeight = Math.max(180, window.innerHeight - (VIEWPORT_MARGIN * 2));

    if (requestedWidth) {
      win.style.width = Math.min(requestedWidth, maxWidth) + "px";
    }

    if (requestedHeight) {
      win.style.height = Math.min(requestedHeight, maxHeight) + "px";
    }
  }

  function clampWindowToViewport(win) {
    const rect = win.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    const currentLeft = parseFloat(win.style.left || "0");
    const currentTop = parseFloat(win.style.top || "0");
    const nextLeft = Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, currentLeft));
    const nextTop = Math.min(maxTop, Math.max(VIEWPORT_MARGIN, currentTop));

    win.style.left = nextLeft + "px";
    win.style.top = nextTop + "px";
  }

  function setupDesktopWindow(win) {
    const handle = win.querySelector("[data-desktop-window-handle]");
    if (!handle) {
      return;
    }

    applyInitialSize(win);

    const rect = win.getBoundingClientRect();
    win.style.left = Math.round((window.innerWidth - rect.width) / 2) + "px";
    win.style.top = Math.round((window.innerHeight - rect.height) / 2) + "px";
    clampWindowToViewport(win);

    let startX;
    let startY;
    let startLeft;
    let startTop;
    let activePointerId = null;

    handle.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) {
        return;
      }

      e.preventDefault();
      const currentRect = win.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = currentRect.left;
      startTop = currentRect.top;
      activePointerId = e.pointerId;
      win.classList.add("is-dragging");
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener("pointermove", function (e) {
      if (activePointerId !== e.pointerId) {
        return;
      }

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const currentRect = win.getBoundingClientRect();
      const maxLeft = window.innerWidth - currentRect.width - VIEWPORT_MARGIN;
      const maxTop = window.innerHeight - currentRect.height - VIEWPORT_MARGIN;

      win.style.left = Math.min(maxLeft, Math.max(VIEWPORT_MARGIN, startLeft + dx)) + "px";
      win.style.top = Math.min(maxTop, Math.max(VIEWPORT_MARGIN, startTop + dy)) + "px";
    });

    function finishDrag(pointerId) {
      activePointerId = null;
      win.classList.remove("is-dragging");
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    }

    handle.addEventListener("pointerup", function (e) {
      if (activePointerId !== e.pointerId) {
        return;
      }
      finishDrag(e.pointerId);
    });

    handle.addEventListener("pointercancel", function (e) {
      if (activePointerId !== e.pointerId) {
        return;
      }
      finishDrag(e.pointerId);
    });

    window.addEventListener("resize", function () {
      applyInitialSize(win);
      clampWindowToViewport(win);
    });
  }

  document.querySelectorAll("[data-desktop-window]").forEach(setupDesktopWindow);
}());
