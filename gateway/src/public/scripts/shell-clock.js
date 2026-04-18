(function attachDesktopClock() {
  const clock = document.getElementById('desktopClock');
  if (!clock) {
    return;
  }

  function renderTime() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  renderTime();
  setInterval(renderTime, 1000);
})();
