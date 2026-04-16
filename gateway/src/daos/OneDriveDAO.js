const pool = require('../db/pool');

class OneDriveDAO {
  async getActiveConnectionByUser(userId) {
    const sql = `
      SELECT
        c.id,
        c.owner_user_id,
        c.status,
        c.account_email,
        c.tenant_id,
        c.drive_id,
        c.connected_at,
        c.last_check_at,
        t.id AS token_id,
        t.access_token_enc,
        t.refresh_token_enc,
        t.access_expires_at,
        t.scope,
        t.token_type
      FROM onedrive_connections c
      LEFT JOIN onedrive_tokens t ON t.connection_id = c.id AND t.is_deleted = 0
      WHERE c.owner_user_id = :userId
        AND c.provider = 'onedrive'
        AND c.is_deleted = 0
      ORDER BY c.created_at DESC
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, { userId });
    return rows[0] || null;
  }

  async touchConnection(connectionId, actor) {
    const sql = `
      UPDATE onedrive_connections
      SET last_check_at = NOW(),
          changed_at = NOW(),
          changed_by = :actor
      WHERE id = :connectionId
    `;

    await pool.execute(sql, { connectionId, actor });
  }

  async createOrUpdatePendingConnection(userId, actor) {
    const existing = await this.getActiveConnectionByUser(userId);
    if (existing) {
      const updateSql = `
        UPDATE onedrive_connections
        SET status = 'pending',
            changed_at = NOW(),
            changed_by = :actor
        WHERE id = :id
      `;
      await pool.execute(updateSql, { actor, id: existing.id });
      return existing.id;
    }

    const insertSql = `
      INSERT INTO onedrive_connections (
        id, owner_user_id, provider, status, created_by
      ) VALUES (
        UUID_v7(), :userId, 'onedrive', 'pending', :actor
      )
    `;

    await pool.execute(insertSql, { userId, actor });

    const created = await this.getActiveConnectionByUser(userId);
    return created?.id || null;
  }

  async createAuthState(userId, connectionId, stateToken, codeVerifier, expiresAt, actor) {
    const sql = `
      INSERT INTO onedrive_auth_states (
        id, owner_user_id, connection_id, state_token, code_verifier, expires_at, created_by
      ) VALUES (
        UUID_v7(), :userId, :connectionId, :stateToken, :codeVerifier, :expiresAt, :actor
      )
    `;

    await pool.execute(sql, {
      userId,
      connectionId,
      stateToken,
      codeVerifier,
      expiresAt,
      actor
    });
  }

  async getValidAuthState(stateToken) {
    const sql = `
      SELECT id, owner_user_id, connection_id, state_token, code_verifier, expires_at, used_at
      FROM onedrive_auth_states
      WHERE state_token = :stateToken
        AND is_deleted = 0
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, { stateToken });
    return rows[0] || null;
  }

  async markAuthStateUsed(stateId, actor) {
    const sql = `
      UPDATE onedrive_auth_states
      SET used_at = NOW(),
          changed_at = NOW(),
          changed_by = :actor
      WHERE id = :stateId
    `;

    await pool.execute(sql, { stateId, actor });
  }

  async saveTokens(connectionId, tokenSet, actor) {
    const softDeleteSql = `
      UPDATE onedrive_tokens
      SET is_deleted = 1,
          changed_at = NOW(),
          changed_by = :actor
      WHERE connection_id = :connectionId
        AND is_deleted = 0
    `;

    await pool.execute(softDeleteSql, { actor, connectionId });

    const insertSql = `
      INSERT INTO onedrive_tokens (
        id,
        connection_id,
        access_token_enc,
        refresh_token_enc,
        access_expires_at,
        scope,
        token_type,
        created_by
      ) VALUES (
        UUID_v7(),
        :connectionId,
        :accessTokenEnc,
        :refreshTokenEnc,
        :accessExpiresAt,
        :scope,
        :tokenType,
        :actor
      )
    `;

    await pool.execute(insertSql, {
      connectionId,
      accessTokenEnc: tokenSet.accessTokenEnc,
      refreshTokenEnc: tokenSet.refreshTokenEnc,
      accessExpiresAt: tokenSet.accessExpiresAt,
      scope: tokenSet.scope,
      tokenType: tokenSet.tokenType,
      actor
    });
  }

  async markConnected(connectionId, metadata, actor) {
    const sql = `
      UPDATE onedrive_connections
      SET status = 'connected',
          tenant_id = :tenantId,
          drive_id = :driveId,
          account_email = :accountEmail,
          connected_at = COALESCE(connected_at, NOW()),
          last_check_at = NOW(),
          changed_at = NOW(),
          changed_by = :actor
      WHERE id = :connectionId
    `;

    await pool.execute(sql, {
      tenantId: metadata.tenantId || null,
      driveId: metadata.driveId || null,
      accountEmail: metadata.accountEmail || null,
      actor,
      connectionId
    });
  }

  async markDisconnectedByUser(userId, actor) {
    const connection = await this.getActiveConnectionByUser(userId);
    if (!connection) {
      return false;
    }

    const sql = `
      UPDATE onedrive_connections
      SET status = 'revoked',
          changed_at = NOW(),
          changed_by = :actor,
          is_deleted = 1
      WHERE id = :id
    `;

    await pool.execute(sql, { actor, id: connection.id });

    const tokenSql = `
      UPDATE onedrive_tokens
      SET is_deleted = 1,
          changed_at = NOW(),
          changed_by = :actor
      WHERE connection_id = :id
        AND is_deleted = 0
    `;

    await pool.execute(tokenSql, { actor, id: connection.id });
    return true;
  }
}

module.exports = new OneDriveDAO();
