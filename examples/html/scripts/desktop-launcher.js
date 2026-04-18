(function () {
  const WINDOW_BASE_Z_INDEX = 100;
  let zIndexSeed = WINDOW_BASE_Z_INDEX;

  const launcherItems = Array.from(document.querySelectorAll("[data-desktop-launcher-item]"));
  const dockItems = Array.from(document.querySelectorAll("[data-desktop-dock-item]"));
  const triggers = launcherItems.concat(dockItems);

  function getWindowByTarget(targetId) {
    if (!targetId) {
      return null;
    }
    return document.getElementById(targetId);
  }

  function setActiveApp(appId) {
    triggers.forEach(function (item) {
      const isActive = item.dataset.appId === appId;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-current", isActive ? "true" : "false");
    });
  }

  function focusWindow(win) {
    document.querySelectorAll("[data-desktop-window]").forEach(function (item) {
      item.classList.remove("is-active");
    });

    zIndexSeed += 1;
    win.style.zIndex = String(zIndexSeed);
    win.classList.add("is-active");
  }

  function openFromTrigger(trigger) {
    const targetId = trigger.dataset.windowTarget;
    const appId = trigger.dataset.appId;
    const targetWindow = getWindowByTarget(targetId);

    if (!targetWindow) {
      return;
    }

    setActiveApp(appId);
    focusWindow(targetWindow);
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      openFromTrigger(trigger);
    });
  });

  document.querySelectorAll("[data-desktop-window]").forEach(function (win) {
    win.addEventListener("pointerdown", function () {
      focusWindow(win);
      if (win.dataset.appId) {
        setActiveApp(win.dataset.appId);
      }
    });
  });

  if (triggers.length > 0) {
    openFromTrigger(triggers[0]);
  }
}());
