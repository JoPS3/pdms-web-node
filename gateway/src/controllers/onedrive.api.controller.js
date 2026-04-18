const { basePath } = require('../config/runtime');
const OneDriveAuthService = require('../services/onedrive-auth.service');

async function getSetup(req, res) {
  try {
    const setup = await OneDriveAuthService.getSetup();
    return res.status(200).json({ status: 'ok', setup });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_setup_read_failed',
      message: error.message
    });
  }
}

async function saveSetup(req, res) {
  try {
    const actor = `gateway-onedrive-setup:${req.serviceUser?.userName || req.serviceUser?.id || 'unknown'}`;
    const result = await OneDriveAuthService.saveSetup(req.body || {}, actor);
    if (!result.ok) {
      return res.status(400).json({
        status: 'error',
        error: result.reason,
        message: 'Dados de setup OneDrive invalidos ou incompletos.'
      });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_setup_save_failed',
      message: error.message
    });
  }
}

async function getStatus(req, res) {
  try {
    const status = await OneDriveAuthService.getStatus(req.serviceUser);
    return res.status(200).json({ status: 'ok', onedrive: status });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_status_failed',
      message: error.message
    });
  }
}

async function startConnect(req, res) {
  try {
    const result = await OneDriveAuthService.startAuthorization(req.serviceUser);
    if (!result.ok) {
      return res.status(400).json({
        status: 'error',
        error: result.reason,
        message: result.message || 'Nao foi possivel iniciar autenticacao OneDrive.'
      });
    }

    return res.status(200).json({
      status: 'ok',
      authorizeUrl: result.authorizeUrl,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_connect_start_failed',
      message: error.message
    });
  }
}

async function callback(req, res) {
  try {
    const result = await OneDriveAuthService.handleCallback(req.query || {});

    if (!result.ok) {
      console.error('[gateway:onedrive] callback failed:', result.reason, result.message || '');
      return res.status(400).render('errors/404', { basePath });
    }

    return res.redirect(`${basePath}/apps`);
  } catch (error) {
    console.error('[gateway:onedrive] callback exception:', error.message);
    return res.status(500).render('errors/404', { basePath });
  }
}

async function disconnect(req, res) {
  try {
    const result = await OneDriveAuthService.disconnect(req.serviceUser);
    return res.status(200).json({
      status: 'ok',
      disconnected: result.disconnected
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_disconnect_failed',
      message: error.message
    });
  }
}

async function smokeWrite(req, res) {
  try {
    const result = await OneDriveAuthService.smokeWrite(req.serviceUser, {
      module: req.body?.module,
      payload: req.body?.payload
    });
    if (!result.ok) {
      return res.status(400).json({
        status: 'error',
        error: result.reason,
        message: result.message || 'Falha no teste de escrita OneDrive.'
      });
    }

    return res.status(200).json({
      status: 'ok',
      write: result
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_smoke_write_failed',
      message: error.message
    });
  }
}

async function smokeRead(req, res) {
  try {
    const result = await OneDriveAuthService.smokeRead(req.serviceUser, {
      module: req.query?.module,
      top: req.query?.top
    });
    if (!result.ok) {
      return res.status(400).json({
        status: 'error',
        error: result.reason,
        message: result.message || 'Falha no teste de leitura OneDrive.'
      });
    }

    return res.status(200).json({
      status: 'ok',
      read: result
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: 'onedrive_smoke_read_failed',
      message: error.message
    });
  }
}

module.exports = {
  getSetup,
  saveSetup,
  getStatus,
  startConnect,
  callback,
  disconnect,
  smokeWrite,
  smokeRead
};
