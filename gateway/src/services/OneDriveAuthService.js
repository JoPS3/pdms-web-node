const crypto = require('crypto');
const OneDriveDAO = require('../daos/OneDriveDAO');
const OneDriveSettingsDAO = require('../daos/OneDriveSettingsDAO');
const {
  encryptSettingsSecret,
  encryptSecret,
  decryptSecret,
  encodeBase64Url
} = require('./onedrive/crypto.helpers');
const { getResolvedConfig } = require('./onedrive/config.helpers');
const {
  isTokenExpiringSoon,
  sanitizeModuleName,
  formatUtcDateParts,
  encodePathSegments,
  parseJsonPayload
} = require('./onedrive/helpers');
const tokenService = require('./onedrive/token.service');
const setupService = require('./onedrive/setup.service');
const smokeService = require('./onedrive/smoke.service');
const oauthService = require('./onedrive/oauth.service');

class OneDriveAuthService {
  constructor() {
    this.ctx = {
      dao: OneDriveDAO,
      settingsDAO: OneDriveSettingsDAO,
      encryptSettingsSecret,
      encryptSecret,
      decryptSecret,
      encodeBase64Url,
      getResolvedConfig,
      isTokenExpiringSoon,
      sanitizeModuleName,
      formatUtcDateParts,
      encodePathSegments,
      parseJsonPayload
    };
  }

  async _getValidAccessToken(user) {
    return tokenService.getValidAccessToken(this.ctx, user);
  }

  async smokeWrite(user, options = {}) {
    const serviceCtx = {
      ...this.ctx,
      getValidAccessToken: (serviceUser) => this._getValidAccessToken(serviceUser)
    };
    return smokeService.smokeWrite(serviceCtx, user, options);
  }

  async smokeRead(user, options = {}) {
    const serviceCtx = {
      ...this.ctx,
      getValidAccessToken: (serviceUser) => this._getValidAccessToken(serviceUser)
    };
    return smokeService.smokeRead(serviceCtx, user, options);
  }

  async getSetup() {
    return setupService.getSetup(this.ctx);
  }

  async saveSetup(payload, actor) {
    return setupService.saveSetup(this.ctx, payload, actor);
  }

  async getStatus(user) {
    return tokenService.getStatus(this.ctx, user);
  }

  async _refreshAccessTokenIfNeeded(connection, actor) {
    return tokenService.refreshAccessTokenIfNeeded(this.ctx, connection, actor);
  }

  async startAuthorization(user) {
    return oauthService.startAuthorization(this.ctx, user);
  }

  async handleCallback(query) {
    return oauthService.handleCallback(this.ctx, query);
  }

  async disconnect(user) {
    return oauthService.disconnect(this.ctx, user);
  }
}

module.exports = new OneDriveAuthService();
