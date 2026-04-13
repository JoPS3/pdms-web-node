const pool = require('../db/pool');
const crypto = require('crypto');

class SessionDAO {
  /**
   * Cria uma nova sessão para um utilizador
   * @param {string} userId - UUID do utilizador
   * @param {string} ipAddress - IP da requisição
   * @param {string} userAgent - User-Agent da requisição
   * @param {number} expiresInHours - Horas até expiração (padrão: 24h)
   * @returns {Promise<string>} session_token
   */
  async create(userId, ipAddress, userAgent, expiresInHours = 24) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const sql = `
      INSERT INTO sessions (id, user_id, session_token, ip_address, user_agent, expires_at, created_by)
      VALUES (UUID_v7(), :userId, :sessionToken, :ipAddress, :userAgent, :expiresAt, :createdBy)
    `;

    try {
      await pool.execute(sql, {
        userId,
        sessionToken,
        ipAddress,
        userAgent,
        expiresAt,
        createdBy: 'gateway-auth'
      });

      return sessionToken;
    } catch (error) {
      throw new Error(`Erro ao criar sessão: ${error.message}`);
    }
  }

  /**
   * Valida uma sessão e retorna dados do utilizador
   * @param {string} sessionToken - Token da sessão
   * @returns {Promise<Object>} { userId, roleId, userName, email, isValid }
   */
  async validate(sessionToken) {
    const sql = `
      SELECT 
        s.id,
        s.user_id,
        s.is_valid,
        s.expires_at,
        u.user_name,
        u.email,
        u.role_id,
        r.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN users_role r ON r.id = u.role_id
      WHERE s.session_token = :sessionToken AND s.is_deleted = 0
    `;

    try {
      const [rows] = await pool.execute(sql, { sessionToken });

      if (rows.length === 0) {
        return { valid: false };
      }

      const session = rows[0];

      // Verifica se está expirada
      if (new Date() > new Date(session.expires_at)) {
        return { valid: false, reason: 'expired' };
      }

      // Verifica se foi marcada como inválida (logout)
      if (session.is_valid === 0) {
        return { valid: false, reason: 'invalidated' };
      }

      // Atualiza last_activity
      await this.updateLastActivity(sessionToken);

      return {
        valid: true,
        userId: session.user_id,
        roleId: session.role_id,
        role: session.role,
        userName: session.user_name,
        email: session.email
      };
    } catch (error) {
      throw new Error(`Erro ao validar sessão: ${error.message}`);
    }
  }

  /**
   * Marca uma sessão como inválida (logout)
   * @param {string} sessionToken - Token da sessão
   * @returns {Promise<void>}
   */
  async invalidate(sessionToken) {
    const sql = `
      UPDATE sessions
      SET is_valid = 0, changed_at = NOW(), changed_by = :changedBy
      WHERE session_token = :sessionToken AND is_deleted = 0
    `;

    try {
      await pool.execute(sql, {
        sessionToken,
        changedBy: 'gateway-auth'
      });
    } catch (error) {
      throw new Error(`Erro ao invalidar sessão: ${error.message}`);
    }
  }

  /**
   * Atualiza last_activity de uma sessão ativa
   * @param {string} sessionToken - Token da sessão
   * @returns {Promise<void>}
   */
  async updateLastActivity(sessionToken) {
    const sql = `
      UPDATE sessions
      SET last_activity = NOW()
      WHERE session_token = :sessionToken AND is_deleted = 0
    `;

    try {
      await pool.execute(sql, { sessionToken });
    } catch (error) {
      // Silent fail - não interrompe o fluxo
      console.error(`Aviso: não foi possível atualizar last_activity: ${error.message}`);
    }
  }

  /**
   * Deleta sessões expiradas (soft delete)
   * @returns {Promise<number>} Número de linhas afetadas
   */
  async deleteExpired() {
    const sql = `
      UPDATE sessions
      SET is_deleted = 1, changed_at = NOW(), changed_by = :changedBy
      WHERE expires_at < NOW() AND is_deleted = 0
    `;

    try {
      const [result] = await pool.execute(sql, { changedBy: 'gateway-maintenance' });
      return result.affectedRows;
    } catch (error) {
      throw new Error(`Erro ao limpar sessões expiradas: ${error.message}`);
    }
  }
}

module.exports = new SessionDAO();
