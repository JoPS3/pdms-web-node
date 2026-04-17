/**
 * Phase 2 Client: Token-based Authentication & Auto-refresh
 * 
 * This module provides:
 * - Token storage management (sessionStorage)
 * - Axios interceptor for Authorization header injection
 * - Auto-refresh before token expiry
 * - Logout token clearing
 * 
 * Usage:
 *   const httpClient = window.pdmsHttpClient;
 *   httpClient.get('/api/endpoint').then(...)
 *   httpClient.setupAutoRefresh();
 */

(function initTokenClient() {
  // Check if axios is available
  if (typeof axios === 'undefined') {
    console.warn('[pdms-token-client] axios not available, skipping setup');
    return;
  }

  // Storage keys
  const STORAGE_KEYS = {
    accessToken: 'pdms_accessToken',
    refreshToken: 'pdms_refreshToken',
    expiresAt: 'pdms_expiresAt'
  };

  // Configuration
  const CONFIG = {
    tokenEndpoint: '/pdms-new/gateway/refresh-token',
    loginEndpoint: '/pdms-new/gateway/login',
    refreshBeforeSeconds: 300, // Refresh 5 min before expiry
    checkIntervalSeconds: 30 // Check token status every 30 sec
  };

  class TokenClient {
    constructor() {
      this.client = axios.create();
      this.autoRefreshTimer = null;
      this.isRefreshing = false;
      this.failedQueue = [];
    }

    /**
     * Store tokens in sessionStorage
     */
    setTokens(accessToken, refreshToken, expiresIn) {
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      
      try {
        sessionStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
        sessionStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
        sessionStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt);
      } catch (err) {
        console.error('[pdms-token-client] Error storing tokens:', err);
      }
    }

    /**
     * Get access token from sessionStorage
     */
    getAccessToken() {
      try {
        return sessionStorage.getItem(STORAGE_KEYS.accessToken) || '';
      } catch (err) {
        console.error('[pdms-token-client] Error reading access token:', err);
        return '';
      }
    }

    /**
     * Get refresh token from sessionStorage
     */
    getRefreshToken() {
      try {
        return sessionStorage.getItem(STORAGE_KEYS.refreshToken) || '';
      } catch (err) {
        console.error('[pdms-token-client] Error reading refresh token:', err);
        return '';
      }
    }

    /**
     * Get token expiry time
     */
    getExpiresAt() {
      try {
        const expiresAtStr = sessionStorage.getItem(STORAGE_KEYS.expiresAt);
        return expiresAtStr ? new Date(expiresAtStr) : null;
      } catch (err) {
        console.error('[pdms-token-client] Error reading expiry:', err);
        return null;
      }
    }

    /**
     * Clear all tokens (logout)
     */
    clearTokens() {
      try {
        sessionStorage.removeItem(STORAGE_KEYS.accessToken);
        sessionStorage.removeItem(STORAGE_KEYS.refreshToken);
        sessionStorage.removeItem(STORAGE_KEYS.expiresAt);
      } catch (err) {
        console.error('[pdms-token-client] Error clearing tokens:', err);
      }
    }

    /**
     * Check if token will expire soon (within refreshBeforeSeconds)
     */
    shouldRefreshToken() {
      const expiresAt = this.getExpiresAt();
      if (!expiresAt) return false;

      const now = new Date();
      const secondsLeft = (expiresAt - now) / 1000;
      
      return secondsLeft > 0 && secondsLeft < CONFIG.refreshBeforeSeconds;
    }

    /**
     * Refresh tokens via /refresh-token endpoint
     */
    async refreshAccessToken() {
      if (this.isRefreshing) {
        // Return a promise that resolves when refresh completes
        return new Promise((resolve, reject) => {
          this.failedQueue.push({ resolve, reject });
        });
      }

      this.isRefreshing = true;
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        this.isRefreshing = false;
        this.redirectToLogin();
        return Promise.reject(new Error('No refresh token available'));
      }

      try {
        const response = await axios.post(CONFIG.tokenEndpoint, { refreshToken });

        if (response.status === 200 && response.data.status === 'ok') {
          this.setTokens(
            response.data.accessToken,
            response.data.refreshToken,
            response.data.expiresIn
          );

          this.isRefreshing = false;
          
          // Process queued requests
          this.failedQueue.forEach(prom => prom.resolve());
          this.failedQueue = [];

          return response.data;
        }
      } catch (err) {
        console.error('[pdms-token-client] Token refresh failed:', err.message);
        this.clearTokens();
        this.isRefreshing = false;
        this.failedQueue.forEach(prom => prom.reject(err));
        this.failedQueue = [];
        this.redirectToLogin();
        throw err;
      }
    }

    /**
     * Setup axios request interceptor (inject Authorization header)
     */
    setupRequestInterceptor() {
      this.client.interceptors.request.use(
        (config) => {
          const token = this.getAccessToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        },
        (error) => Promise.reject(error)
      );
    }

    /**
     * Setup axios response interceptor (handle 401 and auto-refresh)
     */
    setupResponseInterceptor() {
      this.client.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;

          // If 401 and haven't already retried
          if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
              await this.refreshAccessToken();
              
              // Retry with new token
              originalRequest.headers.Authorization = `Bearer ${this.getAccessToken()}`;
              return this.client(originalRequest);
            } catch (refreshErr) {
              return Promise.reject(refreshErr);
            }
          }

          return Promise.reject(error);
        }
      );
    }

    /**
     * Start auto-refresh timer
     */
    setupAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
      }

      this.autoRefreshTimer = setInterval(async () => {
        if (this.shouldRefreshToken()) {
          try {
            await this.refreshAccessToken();
          } catch (err) {
            // Silent fail - will be retried on next interval or caught on next request
          }
        }
      }, CONFIG.checkIntervalSeconds * 1000);
    }

    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
    }

    /**
     * Logout: clear tokens and redirect
     */
    logout() {
      this.stopAutoRefresh();
      this.clearTokens();
      this.redirectToLogin();
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
      window.location.assign(CONFIG.loginEndpoint);
    }

    /**
     * HTTP methods (proxied to axios client)
     */
    get(url, config) {
      return this.client.get(url, config);
    }

    post(url, data, config) {
      return this.client.post(url, data, config);
    }

    put(url, data, config) {
      return this.client.put(url, data, config);
    }

    delete(url, config) {
      return this.client.delete(url, config);
    }

    patch(url, data, config) {
      return this.client.patch(url, data, config);
    }

    /**
     * Initialize: setup interceptors and auto-refresh if tokens exist
     */
    initialize() {
      this.setupRequestInterceptor();
      this.setupResponseInterceptor();

      const token = this.getAccessToken();
      if (token) {
        this.setupAutoRefresh();
      }
    }
  }

  // Create singleton instance
  const tokenClient = new TokenClient();

  // Export to global scope
  if (typeof window !== 'undefined') {
    window.pdmsTokenClient = tokenClient;
    window.pdmsHttpClient = tokenClient; // Alias for convenience

    // Auto-initialize when document is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        tokenClient.initialize();
      });
    } else {
      tokenClient.initialize();
    }
  }
})();
