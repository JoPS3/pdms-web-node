(function initAuthForms() {
  const body = document.body;
  const basePath = body.dataset.basePath || '';

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    initLoginForm(loginForm, basePath);
  }

  const askPasswordForm = document.getElementById('ask-password-form');
  if (askPasswordForm) {
    initAskPasswordForm(askPasswordForm, basePath);
  }

  const setPasswordForm = document.getElementById('set-password-form');
  if (setPasswordForm) {
    initSetPasswordForm(setPasswordForm, basePath);
  }

  function initLoginForm(form, basePathValue) {
    const status = document.getElementById('status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const usernameInput = document.getElementById('username');
      const username = (usernameInput?.value || '').trim();

      if (!username) {
        renderError(status, 'Introduza um utilizador para continuar.');
        return;
      }

      try {
        const data = await postJson(`${basePathValue}/login`, { username });
        if (data.status === 'ok') {
          window.location.href = data.redirect || `${basePathValue}/login`;
        }
      } catch (error) {
        renderError(status, error.message || 'Erro ao processar login. Tente novamente.');
      }
    });
  }

  function initAskPasswordForm(form, basePathValue) {
    const status = document.getElementById('status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userId = form.dataset.userId;
      const passwordInput = document.getElementById('password');
      const password = passwordInput?.value || '';

      if (!password) {
        renderError(status, 'Introduza a password.');
        return;
      }

      try {
        const data = await postJson(`${basePathValue}/verify-password`, { userId, password });
        if (data.status === 'ok' && data.redirect) {
          window.location.href = data.redirect;
        }
      } catch (error) {
        if (error.redirect) {
          window.location.href = error.redirect;
          return;
        }
        renderError(status, error.message || 'Erro ao verificar password.');
      }
    });
  }

  function initSetPasswordForm(form, basePathValue) {
    const status = document.getElementById('status');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userId = form.dataset.userId;
      const passwordInput = document.getElementById('password');
      const passwordConfirmInput = document.getElementById('password-confirm');
      const password = passwordInput?.value || '';
      const passwordConfirm = passwordConfirmInput?.value || '';

      if (password !== passwordConfirm) {
        renderError(status, 'As passwords nao coincidem.');
        return;
      }

      if (password.length < 8) {
        renderError(status, 'Password deve ter no minimo 8 caracteres.');
        return;
      }

      try {
        const data = await postJson(`${basePathValue}/set-password`, { userId, password, passwordConfirm });
        if (data.status === 'ok' && data.redirect) {
          window.location.href = data.redirect;
        }
      } catch (error) {
        if (error.redirect) {
          window.location.href = error.redirect;
          return;
        }
        renderError(status, error.message || 'Erro ao definir password.');
      }
    });
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') {
      const error = new Error(data.error || data.errorMessage || 'Erro inesperado.');
      if (data.redirect) {
        error.redirect = data.redirect;
      }
      throw error;
    }

    return data;
  }

  function renderError(statusElement, message) {
    if (!statusElement) {
      return;
    }
    statusElement.innerHTML = `<span class="error">${escapeHtml(message)}</span>`;
  }

  function escapeHtml(text) {
    const htmlMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, (char) => htmlMap[char]);
  }
})();