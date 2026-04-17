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

  /**
   * Phase 2: Login com geração de tokens (accessToken + refreshToken)
   * @param {string} userName - Username
   * @param {string} password - Password em plain text
   * @param {string} ipAddress - IP da requisição
   * @param {string} userAgent - User-Agent da requisição
   * @returns {Promise<Object>} { success, user, accessToken, refreshToken, expiresIn } ou erro
   */
  async loginWithTokens(userName, password, ipAddress, userAgent) {
    try {
      // Valida credenciais (reutiliza lógica existente)
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
        return { error: 'Utilizador não tem password definida' };
      }

      const passwordValid = await this.verifyPassword(password, user.password);

      if (!passwordValid) {
        return { error: 'Password incorreta' };
      }

      // Cria sessão no BD
      const sessionToken = await SessionDAO.create(
        user.id,
        ipAddress,
        userAgent,
        20 // 20 minutos
      );

      // Obtém a sessão criada para pegar no ID
      const sessionValidation = await SessionDAO.validate(sessionToken);
      
      if (!sessionValidation.valid) {
        throw new Error('Não foi possível validar a sessão criada');
      }

      // Para Phase 2, o accessToken é o mesmo que o sessionToken (pode ser JWT depois)
      // O refreshToken é um token opaco armazenado na BD
      const refreshToken = SessionDAO.generateRefreshToken();
      
      // Liga refresh token à sessão (expira em 7 dias)
      await SessionDAO.linkRefreshToken(sessionValidation.userId, refreshToken, 7);

      // TODO: Aqui pode-se gerar um JWT com expiração curta em vez de sessionToken
      // Para agora, mantemos compatibilidade com o sessionToken

      return {
        success: true,
        user: {
          id: user.id,
          userName: user.user_name,
          email: user.email,
          role: user.role
        },
        accessToken: sessionToken, // Em Phase 2b, será um JWT com 15 min
        refreshToken: refreshToken,
        expiresIn: 900, // 15 minutos (em segundos)
        tokenType: 'Bearer'
      };
    } catch (error) {
      throw new Error(`Erro ao fazer login com tokens: ${error.message}`);
    }
  }

  /**
   * Phase 2: Rotaciona refresh token (emite novo access + refresh token)
   * @param {string} refreshToken - Token de refresh atual
   * @param {string} ipAddress - IP da requisição
   * @param {string} userAgent - User-Agent da requisição
   * @returns {Promise<Object>} { success, accessToken, refreshToken, expiresIn } ou erro
   */
  async refreshTokens(refreshToken, ipAddress, userAgent) {
    try {
      // Valida e rotaciona o refresh token
      const rotationResult = await SessionDAO.rotateRefreshToken(
        refreshToken,
        ipAddress,
        userAgent
      );

      // Cria novo sessionToken (accessToken) para a sessão
      // TODO: Em Phase 2b, isso será um JWT com expiração curta
      const newSessionToken = await SessionDAO.create(
        rotationResult.sessionId,
        ipAddress,
        userAgent,
        20 // 20 minutos
      );

      return {
        success: true,
        accessToken: newSessionToken, // Em Phase 2b, será um JWT com 15 min
        refreshToken: rotationResult.newRefreshToken,
        expiresIn: 900, // 15 minutos (em segundos)
        tokenType: 'Bearer'
      };
    } catch (error) {
      // Converte mensagens de erro em respostas HTTP-friendly
      if (error.message.includes('inválido') || error.message.includes('expirado')) {
        return { 
          error: 'Refresh token inválido ou expirado',
          code: 'INVALID_REFRESH_TOKEN'
        };
      }
      throw new Error(`Erro ao renovar tokens: ${error.message}`);
    }
  }

  /**
   * Phase 2: Logout - invalida todos os tokens de um utilizador
   * @param {string} sessionId - ID da sessão (ou sessionToken)
   * @param {string} refreshToken - Token de refresh (opcional, para invalidar ambos)
   * @returns {Promise<Object>} { success }
   */
  async logoutUser(sessionId, refreshToken = null) {
    try {
      // Invalida a sessão e o refresh token
      await SessionDAO.invalidateRefreshToken(sessionId);
      
      // Se tiver refresh token, tenta invalidar através dele também
      if (refreshToken) {
        try {
          await SessionDAO.rotateRefreshToken(refreshToken, null, null);
        } catch (_err) {
          // Silent fail - se o token já estava inválido, tudo bem
        }
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Erro ao fazer logout: ${error.message}`);
    }
  }
}

module.exports = new AuthService();
