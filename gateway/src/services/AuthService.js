const bcrypt = require('bcrypt');
const UserDAO = require('../daos/UserDAO');
const SessionDAO = require('../daos/SessionDAO');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const SESSION_INACTIVITY_MINUTES = parsePositiveInt(process.env.SESSION_INACTIVITY_MINUTES, 20);
const rawRenewalThreshold = parsePositiveInt(process.env.SESSION_RENEWAL_THRESHOLD_MINUTES, 5);
const SESSION_RENEWAL_THRESHOLD_MINUTES = Math.min(
  rawRenewalThreshold,
  Math.max(SESSION_INACTIVITY_MINUTES - 1, 1)
);

class AuthService {
  async createTokenPairForUser(userId, ipAddress, userAgent) {
    const accessToken = await SessionDAO.create(
      userId,
      ipAddress,
      userAgent,
      SESSION_INACTIVITY_MINUTES
    );

    const sessionValidation = await SessionDAO.validate(accessToken);
    if (!sessionValidation.valid) {
      throw new Error('Nao foi possivel validar a sessao criada');
    }

    const refreshToken = SessionDAO.generateRefreshToken();
    await SessionDAO.linkRefreshToken(sessionValidation.sessionId, refreshToken, 7);

    return {
      accessToken,
      refreshToken,
      expiresIn: SESSION_INACTIVITY_MINUTES * 60,
      tokenType: 'Bearer'
    };
  }

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

      const tokenPair = await this.createTokenPairForUser(user.id, ipAddress, userAgent);

      return {
        success: true,
        userId: user.id,
        roleId: user.role_id,
        role: user.role,
        userName: user.user_name,
        email: user.email,
        sessionToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        tokenType: tokenPair.tokenType
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
      return await SessionDAO.validateAndRenew(sessionToken, SESSION_RENEWAL_THRESHOLD_MINUTES, SESSION_INACTIVITY_MINUTES);
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
      await UserDAO.updatePassword(userId, passwordHash, 'gateway-auth');

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

      const tokenPair = await this.createTokenPairForUser(user.id, ipAddress, userAgent);

      return {
        success: true,
        user: {
          id: user.id,
          userName: user.user_name,
          email: user.email,
          role: user.role
        },
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        tokenType: tokenPair.tokenType
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

      const accessToken = await SessionDAO.create(
        rotationResult.userId,
        ipAddress,
        userAgent,
        20
      );

      const sessionValidation = await SessionDAO.validate(accessToken);
      if (!sessionValidation.valid) {
        throw new Error('Nao foi possivel validar a sessao apos refresh');
      }

      await SessionDAO.linkRefreshToken(sessionValidation.sessionId, rotationResult.newRefreshToken, 7);

      return {
        success: true,
        accessToken,
        refreshToken: rotationResult.newRefreshToken,
        expiresIn: 1200,
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
