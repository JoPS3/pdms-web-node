const SessionDAO = require('../daos/SessionDAO');

/**
 * Scheduler para limpeza de sessões expiradas
 * Executa a cada 10 minutos
 */
class SessionCleanupScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.cleanupIntervalMs = 10 * 60 * 1000; // 10 minutos
  }

  /**
   * Inicia o scheduler de limpeza
   */
  start() {
    if (this.isRunning) {
      console.warn('[SessionCleanupScheduler] Já está em execução');
      return;
    }

    console.log(`[SessionCleanupScheduler] Iniciando... (a cada ${this.cleanupIntervalMs / 1000 / 60} minutos)`);

    // Executar limpeza imediatamente (após 5 segundos para deixar a app inicializar)
    setTimeout(() => this.cleanup(), 5000);

    // Agendar limpeza periódica
    this.intervalId = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    this.isRunning = true;
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('[SessionCleanupScheduler] Parado');
    }
  }

  /**
   * Executa a limpeza de sessões expiradas
   */
  async cleanup() {
    const startTime = Date.now();

    try {
      const deletedCount = await SessionDAO.deleteExpired();

      if (deletedCount > 0) {
        const duration = Date.now() - startTime;
        console.log(
          `[SessionCleanupScheduler] ✅ ${deletedCount} sessão(ões) expirada(s) marcada(s) como deletada(s) em ${duration}ms`
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[SessionCleanupScheduler] ❌ Erro ao limpar sessões expiradas (${duration}ms): ${error.message}`
      );
    }
  }
}

module.exports = new SessionCleanupScheduler();
