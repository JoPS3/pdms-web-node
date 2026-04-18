const pool = require('../db/pool');

class OneDriveSettingsDAO {
  async getSettings() {
    const sql = `
      SELECT
        id,
        provider,
        client_id,
        client_secret_enc,
        tenant_id,
        scopes,
        redirect_uri,
        gateway_public_base_url,
        created_at,
        changed_at
      FROM onedrive_settings
      WHERE provider = 'onedrive' AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql);
    return rows[0] || null;
  }

  async upsertSettings(payload, actor) {
    const current = await this.getSettings();

    if (current) {
      const sql = `
        UPDATE onedrive_settings
        SET client_id = :clientId,
            client_secret_enc = :clientSecretEnc,
            tenant_id = :tenantId,
            scopes = :scopes,
            redirect_uri = :redirectUri,
            gateway_public_base_url = :gatewayPublicBaseUrl,
            changed_at = NOW(),
            changed_by = :actor
        WHERE id = :id
      `;

      await pool.execute(sql, {
        id: current.id,
        clientId: payload.clientId,
        clientSecretEnc: payload.clientSecretEnc,
        tenantId: payload.tenantId,
        scopes: payload.scopes,
        redirectUri: payload.redirectUri,
        gatewayPublicBaseUrl: payload.gatewayPublicBaseUrl,
        actor
      });

      return current.id;
    }

    const insertSql = `
      INSERT INTO onedrive_settings (
        id,
        provider,
        client_id,
        client_secret_enc,
        tenant_id,
        scopes,
        redirect_uri,
        gateway_public_base_url,
        created_by
      ) VALUES (
        UUID_v7(),
        'onedrive',
        :clientId,
        :clientSecretEnc,
        :tenantId,
        :scopes,
        :redirectUri,
        :gatewayPublicBaseUrl,
        :actor
      )
    `;

    await pool.execute(insertSql, {
      clientId: payload.clientId,
      clientSecretEnc: payload.clientSecretEnc,
      tenantId: payload.tenantId,
      scopes: payload.scopes,
      redirectUri: payload.redirectUri,
      gatewayPublicBaseUrl: payload.gatewayPublicBaseUrl,
      actor
    });

    const created = await this.getSettings();
    return created?.id || null;
  }
}

module.exports = new OneDriveSettingsDAO();
