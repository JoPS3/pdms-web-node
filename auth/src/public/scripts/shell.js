/**
 * Desktop Shell Manager
 * Gerencia estado de windows, overlays, drag, e visibilidade
 * Modelo: Single DOM com partials, overlays para preservar desktop
 */

(function initDesktopShell() {
  // Estado global de windows
  const desktopShell = {
    overlay: null,
    activeWindow: null,
    windows: Object.create(null),
    windowParent: Object.create(null),
    hiddenOnOpen: Object.create(null),
    
    init() {
      this.overlay = document.getElementById('desktopOverlay');
      if (!this.overlay) {
        console.warn('[desktop-shell] overlay not found');
        return;
      }
      
      // Registar windows disponíveis
      ['session', 'session-info', 'session-password', 'users', 'users-list'].forEach(windowId => {
        const element = document.getElementById(`window-${windowId}`);
        
        this.windows[windowId] = {
          element,
          titlebar: null,
          state: {
            visible: false,
            dragging: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            originLeft: 0,
            originTop: 0
          }
        };
        
        const w = this.windows[windowId];
        if (w.element) {
          w.titlebar = w.element.querySelector('.desktop-window-titlebar');
          this._attachWindowEvents(windowId);
        }
      });
      
      this._attachGlobalEvents();
      this._attachOverlayEvents();
      this._attachPasswordFormEvents();
      
      // Inicializar clock
      this._initClock();
    },
    
    _initClock() {
      const clock = document.getElementById('desktopClock');
      if (!clock) return;
      
      const renderTime = () => {
        const now = new Date();
        clock.textContent = now.toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit'
        });
      };
      
      renderTime();
      setInterval(renderTime, 1000);
    },
    
    _attachWindowEvents(windowId) {
      const w = this.windows[windowId];
      if (!w.element || !w.titlebar) return;
      
      // Drag logic
      w.titlebar.addEventListener('pointerdown', e => this._onTitlebarPointerDown(e, windowId));
      w.titlebar.addEventListener('pointermove', e => this._onTitlebarPointerMove(e, windowId));
      w.titlebar.addEventListener('pointerup', e => this._onTitlebarPointerUp(e, windowId));
      w.titlebar.addEventListener('pointercancel', e => this._onTitlebarPointerCancel(e, windowId));
      w.titlebar.addEventListener('lostpointercapture', e => this._onTitlebarLostPointerCapture(e, windowId));
      
      // Close button
      const closeBtn = w.element.querySelector('[data-close-window]');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeWindow(windowId));
      }
      
      // Section navigation (users window: data-show-users-section)
      w.element.querySelectorAll('[data-show-users-section]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          const sectionId = btn.dataset.showUsersSection;
          this._showWindowSection(windowId, sectionId);
        });
      });
      
    },
    
    _attachGlobalEvents() {
      // Desktop icon clicks / dock clicks
      document.querySelectorAll('[data-open-window]').forEach(trigger => {
        trigger.addEventListener('click', e => {
          if (!this._isDesktop()) return;
          e.preventDefault();
          const windowId = trigger.dataset.openWindow;
          const parentWindow = trigger.dataset.parentWindow || null;
          const hideParent = trigger.dataset.hideWindowOnOpen === '1';
          this.openWindow(windowId, { parentWindow, hideParent });
        });
      });
      
      // Window close on escape (optional)
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.activeWindow) {
          this.closeWindow(this.activeWindow);
        }
      });
      
      // Lose focus = stop drag
      window.addEventListener('blur', () => {
        if (this.activeWindow) {
          this._stopDrag(this.activeWindow);
        }
      });
    },
    
    _attachOverlayEvents() {
      // Click outside window = close window (optional, uncomment if desired)
      // this.overlay.addEventListener('click', () => {
      //   if (this.activeWindow) {
      //     this.closeWindow(this.activeWindow);
      //   }
      // });
    },

    _attachPasswordFormEvents() {
      const form = document.querySelector('[data-password-form="1"]');
      if (!form) {
        return;
      }

      const feedback = form.querySelector('[data-password-feedback="1"]');
      const currentPasswordInput = form.querySelector('[name="currentPassword"]');
      const newPasswordInput = form.querySelector('[name="newPassword"]');
      const confirmPasswordInput = form.querySelector('[name="confirmPassword"]');

      const writeFeedback = (message, type) => {
        if (!feedback) {
          return;
        }

        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (type) {
          feedback.classList.add(type === 'success' ? 'is-success' : 'is-error');
        }
      };

      form.addEventListener('submit', async event => {
        event.preventDefault();

        const payload = {
          currentPassword: String(currentPasswordInput?.value || ''),
          newPassword: String(newPasswordInput?.value || ''),
          confirmPassword: String(confirmPasswordInput?.value || '')
        };

        if (!payload.newPassword || payload.newPassword.length < 8) {
          writeFeedback('A nova password deve ter pelo menos 8 caracteres.', 'error');
          return;
        }

        if (payload.newPassword !== payload.confirmPassword) {
          writeFeedback('A confirmacao da password nao coincide.', 'error');
          return;
        }

        try {
          writeFeedback('A atualizar password...', null);
          const basePath = window.location.pathname.replace(/\/$/, '');
          const response = await fetch(`${basePath}/internal/session/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok) {
            writeFeedback(data?.message || 'Nao foi possivel alterar a password.', 'error');
            return;
          }

          form.reset();
          writeFeedback(data?.message || 'Password alterada com sucesso.', 'success');
        } catch (error) {
          writeFeedback('Erro de comunicacao com o servidor.', 'error');
        }
      });
    },
    
    openWindow(windowId, options = {}) {
      if (!this.windows[windowId]) {
        console.warn(`[desktop-shell] window "${windowId}" not found`);
        return;
      }

      // Rebuild users list from server on every reopen for deterministic clean state.
      if (windowId === 'users-list' && !options.skipRebuild) {
        this._reloadUsersListClean();
        return;
      }

      if (options.parentWindow && this.windows[options.parentWindow]) {
        this.windowParent[windowId] = options.parentWindow;
        if (options.hideParent) {
          this.windows[options.parentWindow].element.hidden = true;
          this.hiddenOnOpen[windowId] = options.parentWindow;
        }
      } else {
        this.windowParent[windowId] = null;
        this.hiddenOnOpen[windowId] = null;
      }
      
      const w = this.windows[windowId];
      w.element.hidden = false;
      this.overlay.hidden = false;
      this.activeWindow = windowId;
      
      // Reset to center + focus
      this._resetWindowPosition(windowId);
      document.body.classList.add('desktop-window-open');
    },
    
    closeWindow(windowId) {
      if (!this.windows[windowId]) return;
      
      const w = this.windows[windowId];
      this._stopDrag(windowId);
      
      w.element.hidden = true;
      w.state.visible = false;

      const parentWindow = this.windowParent[windowId];
      const hiddenParent = this.hiddenOnOpen[windowId];

      if (hiddenParent && this.windows[hiddenParent]) {
        this.windows[hiddenParent].element.hidden = false;
      }

      this.hiddenOnOpen[windowId] = null;
      
      if (this.activeWindow === windowId) {
        if (parentWindow && this.windows[parentWindow]) {
          this.activeWindow = parentWindow;
          this.overlay.hidden = false;
          document.body.classList.add('desktop-window-open');
        } else {
          this.activeWindow = null;
          this.overlay.hidden = true;
          document.body.classList.remove('desktop-window-open');
        }
      }
    },

    _reloadUsersListClean() {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const keys = Array.from(params.keys());

      keys.forEach((k) => {
        if (/^tf[A-Z]/.test(k)) {
          params.delete(k);
        }
      });

      params.delete('page');
      params.delete('sortBy');
      params.delete('sortDir');
      params.set('openWindow', 'users-list');

      const nextUrl = url.pathname + (params.toString() ? `?${params.toString()}` : '') + url.hash;
      window.location.assign(nextUrl);
    },
    
    _showWindowSection(windowId, sectionId) {
      const w = this.windows[windowId];
      if (!w.element) return;
      
      // Hide all sections, show target
      w.element.querySelectorAll('.window-users-section').forEach(section => {
        section.classList.remove('is-active');
        section.hidden = true;
      });
      
      const targetSection = w.element.querySelector(`#section-${sectionId}`);
      if (targetSection) {
        targetSection.classList.add('is-active');
        targetSection.hidden = false;
      }
    },
    
    _resetWindowPosition(windowId) {
      const w = this.windows[windowId];
      if (!w.element) return;
      
      w.element.style.left = '50%';
      w.element.style.top = '72px';
      w.element.style.transform = 'translateX(-50%)';
    },
    
    _materializeWindowPosition(windowId) {
      const w = this.windows[windowId];
      if (!w.element) return;
      
      const rect = w.element.getBoundingClientRect();
      w.element.style.left = rect.left + 'px';
      w.element.style.top = rect.top + 'px';
      w.element.style.transform = 'none';
    },
    
    _onTitlebarPointerDown(event, windowId) {
      if (event.button !== 0) return;
      if (event.target.closest('.desktop-window-close')) return;
      
      const w = this.windows[windowId];
      this._materializeWindowPosition(windowId);
      
      const rect = w.element.getBoundingClientRect();
      w.state.dragging = true;
      w.state.pointerId = event.pointerId;
      w.state.startX = event.clientX;
      w.state.startY = event.clientY;
      w.state.originLeft = rect.left;
      w.state.originTop = rect.top;
      
      w.titlebar.setPointerCapture(event.pointerId);
      document.body.classList.add('desktop-window-dragging');
      event.preventDefault();
    },
    
    _onTitlebarPointerMove(event, windowId) {
      const w = this.windows[windowId];
      if (!w.state.dragging || w.state.pointerId !== event.pointerId) return;
      
      const deltaX = event.clientX - w.state.startX;
      const deltaY = event.clientY - w.state.startY;
      const maxLeft = window.innerWidth - w.element.offsetWidth - 12;
      const maxTop = window.innerHeight - w.element.offsetHeight - 12;
      const nextLeft = Math.max(12, Math.min(maxLeft, w.state.originLeft + deltaX));
      const nextTop = Math.max(12, Math.min(maxTop, w.state.originTop + deltaY));
      
      w.element.style.left = nextLeft + 'px';
      w.element.style.top = nextTop + 'px';
      w.element.style.transform = 'none';
    },
    
    _onTitlebarPointerUp(event, windowId) {
      this._stopDrag(windowId);
    },
    
    _onTitlebarPointerCancel(event, windowId) {
      this._stopDrag(windowId);
    },
    
    _onTitlebarLostPointerCapture(event, windowId) {
      this._stopDrag(windowId);
    },
    
    _stopDrag(windowId) {
      const w = this.windows[windowId];
      if (!w.state.dragging) return;
      
      if (w.state.pointerId !== null && w.titlebar.hasPointerCapture(w.state.pointerId)) {
        w.titlebar.releasePointerCapture(w.state.pointerId);
      }
      
      w.state.dragging = false;
      w.state.pointerId = null;
      document.body.classList.remove('desktop-window-dragging');
    },
    
    _isDesktop() {
      return window.matchMedia('(min-width: 1024px)').matches;
    }
  };
  
  // Inicializar quando DOM está pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => desktopShell.init());
  } else {
    desktopShell.init();
  }
  
  // Expor globalmente para debug
  window.desktopShell = desktopShell;
})();
