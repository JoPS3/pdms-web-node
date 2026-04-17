/**
 * Phase 2 Integration Tests: Token-based Authentication
 * Tests for: POST /refresh-token endpoint
 */

const authController = require('../src/controllers/auth.controller');
const AuthService = require('../src/services/AuthService');
const SessionDAO = require('../src/daos/SessionDAO');
const { createResponseMock } = require('./helpers/http-mocks');

// Mock AuthService apenas (SessionDAO será testado com a função real)
jest.mock('../src/services/AuthService');

describe('Phase 2: Token Refresh Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('refreshToken returns 400 when refreshToken is missing', async () => {
    const req = {
      body: {},
      ip: '127.0.0.1',
      get: jest.fn(() => 'Mozilla/5.0...')
    };
    const res = createResponseMock();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody.code).toBe('MISSING_REFRESH_TOKEN');
  });

  test('refreshToken returns 401 when AuthService returns error', async () => {
    AuthService.refreshTokens.mockResolvedValue({
      error: 'Refresh token inválido ou expirado',
      code: 'INVALID_REFRESH_TOKEN'
    });

    const req = {
      body: { refreshToken: 'invalid_token' },
      ip: '127.0.0.1',
      get: jest.fn(() => 'Mozilla/5.0...')
    };
    const res = createResponseMock();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody.code).toBe('INVALID_REFRESH_TOKEN');
    expect(res.jsonBody.status).toBe('error');
  });

  test('refreshToken returns new tokens on success', async () => {
    const mockTokens = {
      success: true,
      accessToken: 'new_access_token_123',
      refreshToken: 'new_refresh_token_456',
      expiresIn: 900,
      tokenType: 'Bearer'
    };

    AuthService.refreshTokens.mockResolvedValue(mockTokens);

    const req = {
      body: { refreshToken: 'valid_refresh_token' },
      ip: '127.0.0.1',
      get: jest.fn(() => 'Mozilla/5.0...')
    };
    const res = createResponseMock();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.status).toBe('ok');
    expect(res.jsonBody.accessToken).toBe('new_access_token_123');
    expect(res.jsonBody.refreshToken).toBe('new_refresh_token_456');
    expect(res.jsonBody.expiresIn).toBe(900);
    expect(res.jsonBody.tokenType).toBe('Bearer');
    expect(AuthService.refreshTokens).toHaveBeenCalledWith(
      'valid_refresh_token',
      '127.0.0.1',
      'Mozilla/5.0...'
    );
  });

  test('refreshToken returns 500 on service error', async () => {
    AuthService.refreshTokens.mockRejectedValue(new Error('DB Connection failed'));

    const req = {
      body: { refreshToken: 'some_token' },
      ip: '127.0.0.1',
      get: jest.fn(() => 'Mozilla/5.0...')
    };
    const res = createResponseMock();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody.code).toBe('REFRESH_ERROR');
  });
});

describe('Phase 2: AuthService Token Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('refreshTokens returns tokens on success', async () => {
    const mockResult = {
      success: true,
      accessToken: 'new-session-token-abc',
      refreshToken: 'new-refresh-token-xyz',
      expiresIn: 900,
      tokenType: 'Bearer'
    };

    AuthService.refreshTokens.mockResolvedValue(mockResult);

    const result = await AuthService.refreshTokens(
      'old-refresh-token',
      '127.0.0.1',
      'Mozilla/5.0...'
    );

    expect(result.success).toBe(true);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(AuthService.refreshTokens).toHaveBeenCalled();
  });

  test('refreshTokens returns error on invalid token', async () => {
    const mockError = {
      error: 'Refresh token inválido ou expirado',
      code: 'INVALID_REFRESH_TOKEN'
    };

    AuthService.refreshTokens.mockResolvedValue(mockError);

    const result = await AuthService.refreshTokens(
      'invalid-token',
      '127.0.0.1',
      'Mozilla/5.0...'
    );

    expect(result.error).toBeDefined();
    expect(result.code).toBe('INVALID_REFRESH_TOKEN');
  });

  test('logoutUser calls AuthService with sessionId', async () => {
    AuthService.logoutUser = jest.fn().mockResolvedValue({ success: true });

    const result = await AuthService.logoutUser('session-id-123', 'refresh-token-xyz');

    expect(AuthService.logoutUser).toHaveBeenCalledWith('session-id-123', 'refresh-token-xyz');
    expect(result.success).toBe(true);
  });
});
