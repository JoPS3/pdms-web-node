const { basePath } = require('../config/runtime');

/**
 * Renderiza página de erro 401
 * @param {Object} res - Response object
 * @param {string} reason - Motivo do erro (optional)
 */
function render401(res, reason = 'not_authenticated') {
  return res.status(401).render('errors/401', {
    basePath,
    reason
  });
}

module.exports = { render401 };
