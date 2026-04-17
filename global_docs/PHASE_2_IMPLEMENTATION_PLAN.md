# Phase 2: Explicit Token Propagation - Implementation Plan

## Context
Phase 1 (Bearer token support) is complete and tested. Phase 2 introduces explicit token handling: the client receives `accessToken` + `refreshToken` on login, stores them, and uses the access token in API requests.

This prepares the architecture for:
- Phase 3 multi-domain deployment (tokens are transport-agnostic)
- Automatic token refresh before expiry
- Token rotation on refresh (security best practice)

---

## Architecture Overview

### Token Lifecycle
```
Login (user submits creds)
  ↓
Gateway validates, creates SessionDAO entry
  ↓
Response: { accessToken, refreshToken, expiresIn, user }
  ↓
Client stores in sessionStorage (or secure cookie for native apps)
  ↓
Client makes API calls with Authorization: Bearer <accessToken>
  ↓
API validates at Gateway /validate-session (via Bearer)
  ↓
If expiring soon: auto-refresh in background
  ↓
POST /refresh-token with refreshToken
  ↓
Receive new accessToken + new refreshToken (rotated)
  ↓
Update local storage, retry original request
```

### Token Types & Lifetime
| Token | Type | Lifetime | Storage | Rotation |
|-------|------|----------|---------|----------|
| **Access Token** | JWT (opaque string) | 15 min | sessionStorage | On refresh |
| **Refresh Token** | Opaque string | 7 days | HTTP-only Cookie OR sessionStorage | Always (1:1 replacement) |

---

## Database Schema Changes

### Current SessionDAO table
```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  userId INT NOT NULL,
  roleId INT,
  userName VARCHAR(255),
  email VARCHAR(255),
  createdAt DATETIME,
  expiresAt DATETIME,
  renewedAt DATETIME,
  UNIQUE(userId)
);
```

### Phase 2 Extensions
```sql
-- Add refresh token tracking
ALTER TABLE sessions ADD COLUMN (
  refreshToken VARCHAR(255) UNIQUE,
  refreshTokenExpiresAt DATETIME,
  refreshTokenRotated INT DEFAULT 0
);

-- Track token refresh events for audit
CREATE TABLE session_refresh_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId VARCHAR(255),
  oldRefreshToken VARCHAR(255),
  newRefreshToken VARCHAR(255),
  refreshedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  ipAddress VARCHAR(45),
  userAgent VARCHAR(500),
  FOREIGN KEY (sessionId) REFERENCES sessions(id)
);
```

---

## Gateway Changes Required

### 1. Login Endpoint Response

**Endpoint**: `POST /login`

**Current Response**
```json
{
  "status": "ok",
  "user": { "id": 1, "name": "João", "role": "admin" }
}
```

**New Response (Phase 2)**
```json
{
  "status": "ok",
  "user": { "id": 1, "name": "João", "role": "admin" },
  "accessToken": "eyJhbGc...",
  "refreshToken": "refresh_token_opaque_string_here",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### 2. New Endpoints

#### POST `/refresh-token`
**Purpose**: Rotate tokens before expiry, extend session

**Request**
```json
{
  "refreshToken": "opaque_string_from_client"
}
```

**Response (Success)**
```json
{
  "status": "ok",
  "accessToken": "eyJhbGc...",
  "refreshToken": "new_opaque_string",
  "expiresIn": 900
}
```

**Response (Invalid/Expired)**
```json
{
  "status": "error",
  "code": "INVALID_REFRESH_TOKEN",
  "message": "Refresh token is invalid or expired"
}
// HTTP 401
```

#### POST `/logout`
**Purpose**: Invalidate both tokens

**Request**
```json
{
  "accessToken": "eyJhbGc..."
}
```

**Response**
```json
{
  "status": "ok",
  "message": "Logged out successfully"
}
// HTTP 200
```

#### GET `/validate-session` (Update)
**Current**: Accepts Cookie OR Bearer token

**Phase 2**: Same, but response includes token expiry info for auto-refresh

**Response**
```json
{
  "valid": true,
  "userId": 1,
  "role": "admin",
  "userName": "João",
  "email": "joao@example.com",
  "expiresAt": "2025-04-18T14:30:00Z",
  "shouldRefresh": false
}
```

If `expiresAt - now < 5 min`: set `"shouldRefresh": true`

---

## SessionDAO Changes

### New Methods

```javascript
// Generate refresh token (opaque, not JWT)
generateRefreshToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Store refresh token after login
linkRefreshToken(sessionId, refreshToken, expiresIn) {
  // expiresIn in seconds (e.g., 604800 for 7 days)
  // Set refreshTokenExpiresAt = now + expiresIn
  // Mark refreshTokenRotated = 0
}

// Validate & rotate refresh token
rotateRefreshToken(oldRefreshToken) {
  // 1. Find session by oldRefreshToken
  // 2. Check not expired
  // 3. Generate new refreshToken
  // 4. Update session with new token
  // 5. Log rotation in session_refresh_log
  // 6. Return { sessionId, newRefreshToken }
}

// Invalidate all tokens for user (logout)
invalidateSession(sessionId) {
  // Set refreshToken = NULL, refreshTokenExpiresAt = NULL
  // Keep session row but mark as invalidated (add invalidatedAt column if needed)
}

// Cleanup: delete expired sessions & orphaned refresh tokens (cron job)
cleanupExpiredSessions(olderThan = '1 day') {
  // Delete sessions where refreshTokenExpiresAt < now - olderThan
}
```

---

## AuthService Updates

### New Methods

```javascript
loginWithTokens(username, password) {
  // 1. Validate credentials (existing)
  // 2. Create session in SessionDAO
  // 3. Generate tokens:
  //    - accessToken: (can be stateless JWT or opaque)
  //    - refreshToken: (opaque, stored in DB)
  // 4. Link refreshToken to session
  // 5. Return { accessToken, refreshToken, expiresIn, user }
}

refreshTokens(oldRefreshToken, ipAddress, userAgent) {
  // 1. Call SessionDAO.rotateRefreshToken(oldRefreshToken)
  // 2. Generate new accessToken
  // 3. Log rotation with IP + User-Agent
  // 4. Return { accessToken, refreshToken, expiresIn }
}

logoutUser(sessionId) {
  // Call SessionDAO.invalidateSession(sessionId)
}
```

---

## Routes Updates (gateway)

### New Routes

```javascript
// src/routes/auth.routes.js

// POST /refresh-token
router.post('/refresh-token', (req, res) => {
  const { refreshToken } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('user-agent');
  
  try {
    const { accessToken, refreshToken: newRefreshToken, expiresIn } = 
      authService.refreshTokens(refreshToken, ipAddress, userAgent);
    
    res.json({
      status: 'ok',
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      tokenType: 'Bearer'
    });
  } catch (err) {
    res.status(401).json({
      status: 'error',
      code: err.code || 'REFRESH_FAILED',
      message: err.message
    });
  }
});

// POST /logout
router.post('/logout', requireGatewayAuth, (req, res) => {
  const sessionId = req.session.id;
  authService.logoutUser(sessionId);
  
  // Clear cookie
  res.clearCookie('session_token', {
    httpOnly: true,
    sameSite: 'Strict',
    path: '/'
  });
  
  res.json({ status: 'ok', message: 'Logged out successfully' });
});

// Update POST /login to return tokens
router.post('/login', (req, res) => {
  // ... existing validation ...
  
  try {
    const { accessToken, refreshToken, expiresIn, user } = 
      authService.loginWithTokens(username, password);
    
    // Still set cookie for backward compatibility
    res.cookie('session_token', accessToken, {
      httpOnly: true,
      sameSite: 'Strict',
      path: '/'
    });
    
    res.json({
      status: 'ok',
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      user
    });
  } catch (err) {
    res.status(401).json({
      status: 'error',
      message: err.message
    });
  }
});
```

---

## Client-Side Integration

### 1. Login Form Handling

**Location**: `gateway/src/public/views/auth/login.ejs`

```javascript
// Handle login form submit
document.querySelector('form[method="post"]').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const response = await fetch(e.target.action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData))
  });
  
  const data = await response.json();
  
  if (data.status === 'ok') {
    // Store tokens
    sessionStorage.setItem('accessToken', data.accessToken);
    sessionStorage.setItem('refreshToken', data.refreshToken);
    sessionStorage.setItem('expiresAt', 
      new Date(Date.now() + data.expiresIn * 1000).toISOString()
    );
    
    // Redirect to apps launcher
    window.location.href = '/pdms-new/apps';
  } else {
    // Show error
  }
});
```

### 2. Axios Interceptor (Client Library)

**Location**: `global shared client lib` (or each app's `public/scripts/`)

```javascript
const apiClient = axios.create();

// Request interceptor: inject Authorization header
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = sessionStorage.getItem('refreshToken');
      
      if (refreshToken) {
        try {
          const { data } = await axios.post('/pdms-new/gateway/refresh-token', {
            refreshToken
          });
          
          // Update tokens
          sessionStorage.setItem('accessToken', data.accessToken);
          sessionStorage.setItem('refreshToken', data.refreshToken);
          sessionStorage.setItem('expiresAt', 
            new Date(Date.now() + data.expiresIn * 1000).toISOString()
          );
          
          // Retry original request
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        } catch (refreshErr) {
          // Refresh failed, redirect to login
          window.location.href = '/pdms-new/gateway/login';
          return Promise.reject(refreshErr);
        }
      }
    }
    
    return Promise.reject(error);
  }
);
```

### 3. Auto-Refresh Timer

```javascript
function startTokenRefreshTimer() {
  function checkAndRefresh() {
    const expiresAt = new Date(sessionStorage.getItem('expiresAt'));
    const now = new Date();
    const timeUntilExpiry = expiresAt - now;
    const REFRESH_BEFORE = 5 * 60 * 1000; // Refresh 5 min before expiry
    
    if (timeUntilExpiry < REFRESH_BEFORE && timeUntilExpiry > 0) {
      const refreshToken = sessionStorage.getItem('refreshToken');
      axios.post('/pdms-new/gateway/refresh-token', { refreshToken })
        .then(({ data }) => {
          sessionStorage.setItem('accessToken', data.accessToken);
          sessionStorage.setItem('refreshToken', data.refreshToken);
          sessionStorage.setItem('expiresAt', 
            new Date(Date.now() + data.expiresIn * 1000).toISOString()
          );
        })
        .catch(() => {
          // Silent fail, will be caught on next request
        });
    }
  }
  
  setInterval(checkAndRefresh, 30000); // Check every 30 seconds
}

// Start timer when page loads
if (sessionStorage.getItem('accessToken')) {
  startTokenRefreshTimer();
}
```

---

## Testing Strategy

### Unit Tests

**SessionDAO**
- `generateRefreshToken()` generates unique tokens
- `linkRefreshToken()` stores token with correct expiry
- `rotateRefreshToken()` validates & rotates correctly
- `rotateRefreshToken()` rejects expired tokens
- `invalidateSession()` clears tokens

**AuthService**
- `loginWithTokens()` returns tokens with correct TTL
- `refreshTokens()` rotates tokens & logs event
- `logoutUser()` invalidates session

**Routes**
- POST `/login` returns tokens
- POST `/refresh-token` with valid token → new tokens
- POST `/refresh-token` with invalid token → 401
- POST `/logout` clears tokens

### Integration Tests

**Client Flow**
- Login → tokens stored in sessionStorage
- API call with token → success with 200
- Token refresh timer fires → new tokens stored
- Expired token + auto-refresh → original request retried
- Logout → tokens cleared, redirect to login

### Postman/cURL Tests

```bash
# Login
curl -X POST http://localhost:6000/pdms-new/gateway/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"pass123"}'

# Response: { accessToken, refreshToken, expiresIn }

# Call API with token
curl -X GET http://localhost:6000/pdms-new/auth/users \
  -H "Authorization: Bearer <accessToken>"

# Refresh
curl -X POST http://localhost:6000/pdms-new/gateway/refresh-token \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'

# Logout
curl -X POST http://localhost:6000/pdms-new/gateway/logout \
  -H "Authorization: Bearer <accessToken>"
```

---

## Implementation Sequence

### Step 1: Database Schema & SessionDAO (1-2 hours)
- [ ] Add `refreshToken`, `refreshTokenExpiresAt` columns
- [ ] Create `session_refresh_log` table
- [ ] Implement SessionDAO methods: generateRefreshToken, linkRefreshToken, rotateRefreshToken, invalidateSession

### Step 2: AuthService Updates (1 hour)
- [ ] Implement `loginWithTokens()`
- [ ] Implement `refreshTokens()`
- [ ] Implement `logoutUser()`

### Step 3: Gateway Routes (1.5 hours)
- [ ] Update POST `/login` to return tokens
- [ ] Add POST `/refresh-token` endpoint
- [ ] Add POST `/logout` endpoint
- [ ] Update GET `/validate-session` response with expiry info

### Step 4: Gateway Tests (1 hour)
- [ ] Unit tests for SessionDAO + AuthService
- [ ] Route integration tests
- [ ] Postman validation

### Step 5: Client-Side (Auth Module) (2 hours)
- [ ] Update login form to store tokens
- [ ] Implement axios interceptor + auto-refresh
- [ ] Test token refresh flow

### Step 6: Other Modules (2 hours)
- [ ] Inject axios interceptor in mapas, vendas, compras, rh
- [ ] Test cross-app token sharing (if applicable)

### Step 7: Cleanup & Documentation (1 hour)
- [ ] Remove debug code (if not done)
- [ ] Update API docs
- [ ] Test all together

**Total Estimate**: 9-10 hours

---

## Rollout Strategy

### Phase 2a (Token Generation - Non-Breaking)
- Deploy SessionDAO + AuthService + new routes
- Login still returns session cookie (backward compatible)
- New `/refresh-token` + `/logout` endpoints available but unused
- Tests pass, no client changes yet

### Phase 2b (Client Migration - Per Module)
- Auth module: Update login form + axios interceptor
- Test thoroughly
- Mapas module: Same pattern
- Other modules: Sequential

### Phase 2c (Cleanup - Final)
- Remove legacy session-only logic (if applicable)
- Mark Bearer-as-primary
- Deprecate old endpoints if needed

---

## Success Criteria

✅ Login returns `accessToken` + `refreshToken`
✅ Bearer token accepted in API requests
✅ Auto-refresh fires before expiry
✅ Token refresh returns new tokens (both parts)
✅ Logout invalidates tokens
✅ All tests passing
✅ Cross-domain ready (infrastructure in place for Phase 3)

---

## Notes for Future Phases

### Phase 3 Enabler
Once Phase 2 is complete:
- Apps can be deployed to different domains
- CORS configured with credentials
- Token in header (not cookie domain-dependent)
- Same refresh flow works cross-domain

### Security Improvements (Phase 3+)
- Refresh token rotation per-request (already tracked)
- Suspicious activity detection (multiple refreshes from different IPs)
- Token revocation list (for logout across all tabs)
- Device fingerprinting (optional, for high-security scenarios)
