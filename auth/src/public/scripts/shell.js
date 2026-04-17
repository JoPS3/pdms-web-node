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
    zCounter: 1010,
    windows: Object.create(null),
    windowParent: Object.create(null),
    hiddenOnOpen: Object.create(null),
    
    init() {
      this._installInternalApiSessionGuard();

      this.overlay = document.getElementById('desktopOverlay');
      if (!this.overlay) {
        console.warn('[desktop-shell] overlay not found');
        return;
      }
      
      // Registar windows disponíveis
      ['session', 'session-info', 'session-password', 'users', 'onedrive', 'onedrive-setup', 'users-list', 'user-edit'].forEach(windowId => {
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
      this._attachOneDriveEvents();
      this._attachOneDriveSetupEvents();
      
      // Inicializar clock
      this._initClock();
    },

    _installInternalApiSessionGuard() {
      if (window.__pdmsInternalApiSessionGuardInstalled) {
        return;
      }

      if (typeof window.fetch !== 'function') {
        return;
      }

      const originalFetch = window.fetch.bind(window);
      const gatewayBasePath = String(document.body?.dataset?.gatewayBasePath || '').replace(/\/+$/, '');
      const loginUrl = `${gatewayBasePath}/login`;

      const requestPath = (input) => {
        try {
          if (typeof input === 'string') {
            return new URL(input, window.location.origin).pathname;
          }
          if (input && typeof input.url === 'string') {
            return new URL(input.url, window.location.origin).pathname;
          }
        } catch (_error) {
          return '';
        }
        return '';
      };

      const isInternalApi = (pathName) => pathName.includes('/internal/');

      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const pathName = requestPath(args[0]);

        if (response?.status === 401 && isInternalApi(pathName)) {
          // API routes return JSON 401; force full login redirect to avoid stale desktop shell state.
          if (!window.location.pathname.endsWith('/login')) {
            window.location.assign(loginUrl);
          }
        }

        return response;
      };

      window.__pdmsInternalApiSessionGuardInstalled = true;
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

    _attachOneDriveEvents() {
      const statusPanel = document.querySelector('[data-onedrive-status-panel]');
      const statusText = document.querySelector('[data-onedrive-status-text]');
      const statusDismiss = document.querySelector('[data-onedrive-status-dismiss]');
      const confirmModal = document.querySelector('[data-onedrive-confirm-modal]');
      const actions = document.querySelectorAll('[data-onedrive-action]');
      const setupForm = document.querySelector('[data-onedrive-setup-form="1"]');
      let oneDriveSetupHasSecret = false;
      if (!actions.length) {
        return;
      }

      const showStatus = (message, type) => {
        if (!statusPanel || !statusText) {
          return;
        }
        statusText.textContent = message;
        statusPanel.classList.remove('is-success', 'is-error');
        if (type) {
          statusPanel.classList.add(type === 'success' ? 'is-success' : 'is-error');
        }
        statusPanel.style.display = '';
        statusPanel.hidden = false;
      };

      const hideStatus = () => {
        if (statusPanel) {
          statusPanel.style.display = 'none';
          statusPanel.hidden = true;
        }
      };

      if (statusDismiss) {
        statusDismiss.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideStatus();
        });
      }

      document.addEventListener('click', (event) => {
        if (event.target.closest('[data-onedrive-status-dismiss]')) {
          event.preventDefault();
          event.stopPropagation();
          hideStatus();
        }
      });

      const basePath = document.body.dataset.gatewayBasePath || window.location.pathname.replace(/\/$/, '');

      const connectBtn = Array.from(actions).find((b) => b.dataset.onedriveAction === 'connect');
      const disconnectBtn = Array.from(actions).find((b) => b.dataset.onedriveAction === 'disconnect');

      const applyConnectionState = (connected) => {
        if (connectBtn) {
          connectBtn.disabled = connected;
          connectBtn.title = connected ? 'Ja existe uma ligacao ativa' : 'Autenticar e ligar ao OneDrive';
        }
        if (disconnectBtn) {
          disconnectBtn.disabled = !connected;
        }
      };

      const loadStatus = async () => {
        try {
          const response = await fetch(`${basePath}/internal/onedrive/status`, {
            method: 'GET',
            credentials: 'same-origin'
          });
          const data = await response.json();
          const connected = response.ok && !!data?.onedrive?.connected;
          applyConnectionState(connected);
          if (connected) {
            const expiresLabel = data?.onedrive?.expiresAt
              ? new Date(data.onedrive.expiresAt).toLocaleString('pt-PT')
              : 'n/d';
            showStatus(`Ligado. Expira: ${expiresLabel}`, 'success');
          }
        } catch (_error) {
          // no-op
        }
      };

      const doDisconnect = async () => {
        try {
          const response = await fetch(`${basePath}/internal/onedrive/disconnect`, {
            method: 'POST',
            credentials: 'same-origin'
          });
          const data = await response.json();
          if (!response.ok) {
            showStatus(data?.message || 'Falha ao desligar OneDrive.', 'error');
            return;
          }
          showStatus('Ligacao OneDrive revogada com sucesso.', 'success');
          applyConnectionState(false);
        } catch (_error) {
          showStatus('Erro de comunicacao com o servidor.', 'error');
        }
      };

      if (confirmModal) {
        confirmModal.querySelectorAll('[data-onedrive-confirm]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            confirmModal.hidden = true;
            if (btn.dataset.onedriveConfirm === 'yes') {
              await doDisconnect();
            }
          });
        });
      }

      actions.forEach((btn) => {
        btn.addEventListener('click', async () => {
          const action = String(btn.dataset.onedriveAction || '');

          if (action === 'status') {
            try {
              const response = await fetch(`${basePath}/internal/onedrive/status`, {
                method: 'GET',
                credentials: 'same-origin'
              });
              const data = await response.json();
              if (!response.ok) {
                showStatus(data?.message || 'Falha ao consultar estado OneDrive.', 'error');
                return;
              }
              const linked = !!data?.onedrive?.connected;
              applyConnectionState(linked);
              if (!linked) {
                showStatus('OneDrive sem ligacao ativa.', 'error');
                return;
              }
              const expiresLabel = data?.onedrive?.expiresAt
                ? new Date(data.onedrive.expiresAt).toLocaleString('pt-PT')
                : 'n/d';
              showStatus(`Ligado. Expira: ${expiresLabel}`, 'success');
            } catch (_error) {
              showStatus('Erro de comunicacao com o servidor.', 'error');
            }
            return;
          }

          if (action === 'connect') {
            try {
              const response = await fetch(`${basePath}/internal/onedrive/connect`, {
                method: 'POST',
                credentials: 'same-origin'
              });
              const data = await response.json();
              if (!response.ok) {
                showStatus(data?.message || 'Falha ao iniciar autenticacao OneDrive.', 'error');
                return;
              }
              if (!data?.authorizeUrl) {
                showStatus('Gateway nao devolveu URL de autorizacao.', 'error');
                return;
              }
              showStatus('A redirecionar para autenticacao Microsoft...', 'success');
              window.location.assign(data.authorizeUrl);
            } catch (_error) {
              showStatus('Erro de comunicacao com o servidor.', 'error');
            }
            return;
          }

          if (action === 'disconnect') {
            if (confirmModal) {
              confirmModal.hidden = false;
            } else {
              await doDisconnect();
            }
            return;
          }
        });
      });

      loadStatus();
    },

    _attachOneDriveSetupEvents() {
      const setupForm = document.querySelector('[data-onedrive-setup-form="1"]');
      if (!setupForm) {
        return;
      }

      let oneDriveSetupHasSecret = false;
      const feedbackEl = setupForm.querySelector('[data-onedrive-setup-feedback]');
      const secretHint = setupForm.querySelector('[data-od-secret-hint]');

      const showSetupFeedback = (message, type) => {
        if (!feedbackEl) {
          return;
        }
        feedbackEl.textContent = message;
        feedbackEl.classList.remove('is-success', 'is-error');
        if (type) {
          feedbackEl.classList.add(type === 'success' ? 'is-success' : 'is-error');
        }
        feedbackEl.hidden = false;
      };

      const basePath = document.body.dataset.gatewayBasePath || window.location.pathname.replace(/\/$/, '');

      const loadSetup = async () => {
        try {
          const response = await fetch(`${basePath}/internal/onedrive/setup`, {
            method: 'GET',
            credentials: 'same-origin'
          });
          const data = await response.json();
          if (!response.ok || !data?.setup) {
            return;
          }
          const fields = setupForm.elements;
          if (fields.clientId) fields.clientId.value = data.setup.clientId || '';
          if (fields.tenantId) fields.tenantId.value = data.setup.tenantId || 'common';
          if (fields.scopes) fields.scopes.value = data.setup.scopes || 'offline_access User.Read Files.ReadWrite.All';
          if (fields.gatewayPublicBaseUrl) fields.gatewayPublicBaseUrl.value = data.setup.gatewayPublicBaseUrl || '';
          if (fields.redirectUri) fields.redirectUri.value = data.setup.redirectUri || '';

          if (data.setup.hasClientSecret) {
            oneDriveSetupHasSecret = true;
            if (fields.clientSecret) {
              fields.clientSecret.placeholder = 'Deixe vazio para manter o atual';
            }
            if (secretHint) {
              secretHint.hidden = false;
            }
          }
        } catch (_error) {
          // no-op
        }
      };

      loadSetup();

      setupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fields = setupForm.elements;

        const payload = {
          clientId: String(fields.clientId?.value || '').trim(),
          clientSecret: String(fields.clientSecret?.value || '').trim(),
          tenantId: String(fields.tenantId?.value || 'common').trim(),
          scopes: String(fields.scopes?.value || '').trim(),
          gatewayPublicBaseUrl: String(fields.gatewayPublicBaseUrl?.value || '').trim(),
          redirectUri: String(fields.redirectUri?.value || '').trim()
        };

        if (!payload.clientId) {
          showSetupFeedback('Client ID e obrigatorio.', 'error');
          return;
        }

        if (!payload.clientSecret && !oneDriveSetupHasSecret) {
          showSetupFeedback('Client Secret e obrigatorio para guardar setup.', 'error');
          return;
        }

        showSetupFeedback('A guardar...', null);

        try {
          const response = await fetch(`${basePath}/internal/onedrive/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok) {
            showSetupFeedback(data?.message || 'Falha ao guardar setup OneDrive.', 'error');
            return;
          }

          if (fields.clientSecret) {
            if (payload.clientSecret) {
              oneDriveSetupHasSecret = true;
            }
            fields.clientSecret.value = '';
            fields.clientSecret.placeholder = 'Deixe vazio para manter o atual';
          }
          if (secretHint) {
            secretHint.hidden = false;
          }
          showSetupFeedback('Setup guardado com sucesso.', 'success');
        } catch (_error) {
          showSetupFeedback('Erro de comunicacao ao guardar setup.', 'error');
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

      // For top-level launches, keep only one root window visible.
      if (!options.parentWindow) {
        this._hideAllWindows();
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
      this._bringToFront(windowId);
      
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
          this._bringToFront(parentWindow);
          this.overlay.hidden = false;
          document.body.classList.add('desktop-window-open');
        } else {
          this.activeWindow = null;
          this.overlay.hidden = true;
          document.body.classList.remove('desktop-window-open');
        }
      }

      if (!this._hasVisibleWindows()) {
        this.activeWindow = null;
        this.overlay.hidden = true;
        document.body.classList.remove('desktop-window-open');
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
      params.set('owSrc', 'auth');

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

    _hasVisibleWindows() {
      return Object.values(this.windows).some((w) => w.element && !w.element.hidden);
    },

    _hideAllWindows() {
      Object.keys(this.windows).forEach((id) => {
        const w = this.windows[id];
        if (!w.element) return;
        w.element.hidden = true;
        w.state.visible = false;
        this.windowParent[id] = null;
        this.hiddenOnOpen[id] = null;
      });
      this.activeWindow = null;
      this.overlay.hidden = true;
      document.body.classList.remove('desktop-window-open');
    },

    _bringToFront(windowId) {
      const w = this.windows[windowId];
      if (!w || !w.element) return;
      this.zCounter += 1;
      w.element.style.zIndex = String(this.zCounter);
    },
    
    _onTitlebarPointerDown(event, windowId) {
      if (event.button !== 0) return;
      if (event.target.closest('.desktop-window-close')) return;
      
      const w = this.windows[windowId];
      this.activeWindow = windowId;
      this._bringToFront(windowId);
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
