const bcrypt = require('bcrypt');
const UserDAO = require('../daos/UserDAO');
const SessionDAO = require('../daos/SessionDAO');

class AuthService {
  /**
   * Faz hash de uma password com bcrypt
   * @param {string} password - Password em plain text
   * @returns {Promise<string>} Hash bcrypt
   */
  async hashPassword(password) {
    try {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error(`Erro ao fazer hash da password: ${error.message}`);
    }
  }

  /**
   * Valida password contra um hash bcrypt
   * @param {string} password - Password em plain text
   * @param {string} hash - Hash bcrypt
   * @returns {Promise<boolean>}
   */
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Erro ao verificar password: ${error.message}`);
    }
  }

  /**
   * Faz login de um utilizador
   * @param {string} userName - Username
   * @param {string} password - Password em plain text
   * @param {string} ipAddress - IP da requisição
   * @param {string} userAgent - User-Agent da requisição
   * @returns {Promise<Object>} { userId, roleId, userName, email, sessionToken } ou erro
   */
  async login(userName, password, ipAddress, userAgent) {
    try {
      // Busca utilizador
      const user = await UserDAO.findByUserName(userName);

      if (!user) {
        return { error: 'Utilizador não encontrado' };
      }

      // Verifica se foi eliminado
      if (user.is_deleted) {
        return { error: 'Utilizador não encontrado' };
      }

      // Verifica autorização
      if (!user.is_authorized) {
        return { error: 'Utilizador não autorizado' };
      }

      // Verifica password
      if (!user.password) {
        return { error: 'Utilizador não tem password definida' };
      }

      const passwordValid = await this.verifyPassword(password, user.password);

      if (!passwordValid) {
        return { error: 'Password incorreta' };
      }

      // Cria sessão
      const sessionToken = await SessionDAO.create(
        user.id,
        ipAddress,
        userAgent,
        20 // 20 minutos
      );

      return {
        success: true,
        userId: user.id,
        roleId: user.role_id,
        role: user.role,
        userName: user.user_name,
        email: user.email,
        sessionToken
      };
    } catch (error) {
      throw new Error(`Erro ao fazer login: ${error.message}`);
    }
  }

  /**
   * Valida uma sessão ativa e renova se está próxima de expirar (Sliding Window)
   * @param {string} sessionToken - Token da sessão
   * @returns {Promise<Object>} { valid: true, renewed, ... } ou { valid: false }
   */
  async validateSession(sessionToken) {
    try {
      return await SessionDAO.validateAndRenew(sessionToken);
    } catch (error) {
      throw new Error(`Erro ao validar e renovar sessão: ${error.message}`);
    }
  }

  /**
   * Faz logout de uma sessão
   * @param {string} sessionToken - Token da sessão
   * @returns {Promise<void>}
   */
  async logout(sessionToken) {
    try {
      await SessionDAO.invalidate(sessionToken);
    } catch (error) {
      throw new Error(`Erro ao fazer logout: ${error.message}`);
    }
  }

  /**
   * Verifica username e determina próximo passo
   * @param {string} userName - Username
   * @returns {Promise<Object>} { status, userId, hasPassword } ou { error }
   */
  async checkUsername(userName) {
    try {
      const user = await UserDAO.findByUserName(userName);

      if (!user) {
        return { error: 'Utilizador não encontrado' };
      }

      if (user.is_deleted) {
        return { error: 'Utilizador não encontrado' };
      }

      if (!user.is_authorized) {
        return { error: 'Utilizador não autorizado' };
      }

      // Retorna status em função de ter password ou não
      const hasPassword = user.password && user.password.trim() !== '';

      return {
        success: true,
        userId: user.id,
        userName: user.user_name,
        hasPassword: hasPassword,
        status: hasPassword ? 'ask_password' : 'set_password'
      };
    } catch (error) {
      throw new Error(`Erro ao verificar utilizador: ${error.message}`);
    }
  }

  /**
   * Login com username e password (2º passo se user já tem password)
   * @param {string} userName - Username
   * @param {string} password - Password em plain text
   * @param {string} ipAddress - IP da requisição
   * @param {string} userAgent - User-Agent da requisição
   * @returns {Promise<Object>} { success, userId, roleId, sessionToken, ... } ou erro
   */
  async loginWithPassword(userName, password, ipAddress, userAgent) {
    try {
      const user = await UserDAO.findByUserName(userName);

      if (!user) {
        return { error: 'Utilizador não encontrado' };
      }

      if (user.is_deleted) {
        return { error: 'Utilizador não encontrado' };
      }

      if (!user.is_authorized) {
        return { error: 'Utilizador não autorizado' };
      }

      if (!user.password) {
        return { error: 'Utilizador não tem password definida. Use a opção de definir password.' };
      }

      const passwordValid = await this.verifyPassword(password, user.password);

      if (!passwordValid) {
        return { error: 'Password incorreta' };
      }

      // Cria sessão
      const sessionToken = await SessionDAO.create(
        user.id,
        ipAddress,
        userAgent,
        20 // 20 minutos
      );

      return {
        success: true,
        userId: user.id,
        roleId: user.role_id,
        userName: user.user_name,
        email: user.email,
        sessionToken
      };
    } catch (error) {
      throw new Error(`Erro ao fazer login: ${error.message}`);
    }
  }

  /**
   * Define password para um utilizador (primeira vez ou reset)
   * @param {string} userId - UUID do utilizador
   * @param {string} password - Nova password em plain text
   * @param {string} ipAddress - IP da requisição
   * @param {string} userAgent - User-Agent da requisição
   * @returns {Promise<Object>} { success, sessionToken } ou erro
   */
  async setPassword(userId, password, ipAddress, userAgent) {
    try {
      // Valida força da password (mínimo 8 caracteres)
      if (!password || password.length < 8) {
        return { error: 'Password deve ter no mínimo 8 caracteres' };
      }

      const passwordHash = await this.hashPassword(password);

      // Busca user para verificar autenticação
      const user = await UserDAO.findById(userId);

      if (!user) {
        return { error: 'Utilizador não encontrado' };
      }

      if (!user.is_authorized) {
        return { error: 'Utilizador não autorizado' };
      }

      // Atualiza password na BD
      const updateSql = `
        UPDATE users 
        SET password = :password, changed_at = NOW(), changed_by = :changedBy
        WHERE id = :userId AND is_deleted = 0
      `;

      await require('../db/pool').execute(updateSql, {
        password: passwordHash,
        userId,
        changedBy: 'gateway-auth'
      });

      // Cria sessão
      const sessionToken = await SessionDAO.create(
        user.id,
        ipAddress,
        userAgent,
        20 // 20 minutos
      );

      return {
        success: true,
        userId: user.id,
        roleId: user.role_id,
        role: user.role,
        userName: user.user_name,
        email: user.email,
        sessionToken
      };
    } catch (error) {
      throw new Error(`Erro ao definir password: ${error.message}`);
    }
  }
}

module.exports = new AuthService();
