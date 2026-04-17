const pool = require('../db/pool');

class UserDAO {
  /**
   * Busca utilizador por username com todos os campos (incluindo password)
   * @param {string} userName - Username
   * @returns {Promise<Object>} Dados completos do utilizador
   */
  async findByUserName(userName) {
    const sql = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.user_name,
        u.email,
        u.password,
        u.role_id,
        u.is_authorized,
        u.is_deleted,
        r.role
      FROM users u
      LEFT JOIN users_role r ON r.id = u.role_id
      WHERE u.user_name = :userName
    `;

    try {
      const [rows] = await pool.execute(sql, { userName });
      
      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      throw new Error(`Erro ao buscar utilizador: ${error.message}`);
    }
  }

  /**
   * Busca utilizador por email
   * @param {string} email - Email
   * @returns {Promise<Object>} Dados do utilizador
   */
  async findByEmail(email) {
    const sql = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.user_name,
        u.email,
        u.role_id,
        u.is_authorized
      FROM users u
      WHERE u.email = :email AND u.is_deleted = 0
    `;

    try {
      const [rows] = await pool.execute(sql, { email });
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw new Error(`Erro ao buscar utilizador por email: ${error.message}`);
    }
  }

  /**
   * Busca utilizador por ID
   * @param {string} userId - UUID do utilizador
   * @returns {Promise<Object>} Dados do utilizador
   */
  async findById(userId) {
    const sql = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.user_name,
        u.email,
        u.role_id,
        u.is_authorized,
        ur.role
      FROM users u
      LEFT JOIN users_role ur ON u.role_id = ur.id
      WHERE u.id = :userId AND u.is_deleted = 0
    `;

    try {
      const [rows] = await pool.execute(sql, { userId });
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw new Error(`Erro ao buscar utilizador por ID: ${error.message}`);
    }
  }

  async updatePassword(userId, passwordHash, changedBy) {
    const sql = `
      UPDATE users
      SET password = :passwordHash, changed_at = NOW(), changed_by = :changedBy
      WHERE id = :userId AND is_deleted = 0
    `;

    try {
      await pool.execute(sql, { userId, passwordHash, changedBy });
    } catch (error) {
      throw new Error(`Erro ao atualizar password: ${error.message}`);
    }
  }
}

module.exports = new UserDAO();
