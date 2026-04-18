const axios = require('axios');
const { parseSessionToken } = require('../middlewares/session.middleware');

async function getInternalOneDriveStatus(req, res) {
  const sessionToken = parseSessionToken(req);
  const gatewayUrl = req.app.get('gatewayOneDriveStatusUrl');

  if (!gatewayUrl) {
    return res.status(500).json({
      error: 'gateway_onedrive_url_missing',
      message: 'Endpoint de status OneDrive do gateway nao configurado.'
    });
  }

  try {
    const response = await axios.get(gatewayUrl, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeout: 7000,
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (_error) {
    return res.status(502).json({
      error: 'gateway_onedrive_unavailable',
      message: 'Nao foi possivel consultar o estado de ligacao OneDrive no gateway.'
    });
  }
}

async function getInternalOneDriveSetup(req, res) {
  const sessionToken = parseSessionToken(req);
  const gatewayUrl = req.app.get('gatewayOneDriveSetupUrl');

  if (!gatewayUrl) {
    return res.status(500).json({
      error: 'gateway_onedrive_setup_url_missing',
      message: 'Endpoint de setup OneDrive do gateway nao configurado.'
    });
  }

  try {
    const response = await axios.get(gatewayUrl, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeout: 7000,
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (_error) {
    return res.status(502).json({
      error: 'gateway_onedrive_unavailable',
      message: 'Nao foi possivel obter setup OneDrive no gateway.'
    });
  }
}

async function saveInternalOneDriveSetup(req, res) {
  const sessionToken = parseSessionToken(req);
  const gatewayUrl = req.app.get('gatewayOneDriveSetupUrl');

  if (!gatewayUrl) {
    return res.status(500).json({
      error: 'gateway_onedrive_setup_url_missing',
      message: 'Endpoint de setup OneDrive do gateway nao configurado.'
    });
  }

  try {
    const response = await axios.post(gatewayUrl, req.body || {}, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeout: 7000,
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (_error) {
    return res.status(502).json({
      error: 'gateway_onedrive_unavailable',
      message: 'Nao foi possivel guardar setup OneDrive no gateway.'
    });
  }
}

async function startInternalOneDriveConnect(req, res) {
  const sessionToken = parseSessionToken(req);
  const gatewayUrl = req.app.get('gatewayOneDriveConnectUrl');

  if (!gatewayUrl) {
    return res.status(500).json({
      error: 'gateway_onedrive_url_missing',
      message: 'Endpoint de ligacao OneDrive do gateway nao configurado.'
    });
  }

  try {
    const response = await axios.post(gatewayUrl, {}, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeout: 7000,
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (_error) {
    return res.status(502).json({
      error: 'gateway_onedrive_unavailable',
      message: 'Nao foi possivel iniciar autenticacao OneDrive no gateway.'
    });
  }
}

async function disconnectInternalOneDrive(req, res) {
  const sessionToken = parseSessionToken(req);
  const gatewayUrl = req.app.get('gatewayOneDriveDisconnectUrl');

  if (!gatewayUrl) {
    return res.status(500).json({
      error: 'gateway_onedrive_url_missing',
      message: 'Endpoint de desligar OneDrive do gateway nao configurado.'
    });
  }

  try {
    const response = await axios.post(gatewayUrl, {}, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeout: 7000,
      validateStatus: () => true
    });
    return res.status(response.status).json(response.data);
  } catch (_error) {
    return res.status(502).json({
      error: 'gateway_onedrive_unavailable',
      message: 'Nao foi possivel desligar OneDrive no gateway.'
    });
  }
}

module.exports = {
  getInternalOneDriveStatus,
  getInternalOneDriveSetup,
  saveInternalOneDriveSetup,
  startInternalOneDriveConnect,
  disconnectInternalOneDrive
};
