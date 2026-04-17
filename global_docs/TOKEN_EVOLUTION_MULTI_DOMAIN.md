# Token Evolution: Multi-Domain Authorization Roadmap

## Context
Currently, PDMS uses session tokens via HTTP-only cookies, working well on the same domain with a reverse proxy (Gateway). For future multi-domain deployment, the architecture needs to evolve to pass tokens explicitly to each app, while keeping Gateway as the single source of truth for session validation.

## Phase 1: Support Bearer Tokens (Active Now)

### Gateway Changes
- **Endpoint**: `GET /validate-session`
- **Accepts both**:
  1. Cookie: `session_token` (existing, backward compatible)
  2. Header: `Authorization: Bearer <token>` (new)
- **Response**: JSON with user data + renewal info

**Why**: Apps can now validate sessions without relying on cookie-domain inheritance.

### App Changes (Auth Module)
- **Middleware**: `requireGatewayAuth` and `requireGatewaySessionApi`
- **Now sends**:
  1. Authorization header: `Authorization: Bearer <sessionToken>`
  2. Cookie as fallback (for browser compatibility)
- **Works identical today**: Same domain, cookie still primary transport

**Why**: Prepares infrastructure for cross-domain without breaking current flow.

---

## Phase 2: Explicit Token Propagation to Client (Next)

### Goal
When user logs in, return access token explicitly (not just cookie). Each app client stores and forwards token in Authorization header.

### Flow
```
1. User logs in at Gateway
   POST /login + credentials
   ↓
2. Gateway validates, creates session
   Response: { accessToken, refreshToken, expiresIn, user }
   ↓
3. Client stores tokens (localStorage or sessionStorage)
   ↓
4. Client loads Auth app
   GET /auth with Authorization: Bearer <accessToken>
   ↓
5. Auth validates token at Gateway
   GET /validate-session with Authorization: Bearer <accessToken>
   ↓
6. Gateway returns user data + renewal flag
```

### New Endpoints (Gateway)
- **POST `/refresh-token`**
  - Input: `refreshToken`
  - Response: `{ accessToken, expiresIn }`
  - Validates refresh token rotation, revokes old if compromised

- **POST `/logout`**
  - Input: `accessToken`
  - Invalidates both access and refresh tokens

### Token Lifetime
- **Access Token**: Short-lived (5-15 min)
- **Refresh Token**: Medium-lived (7 days), rotative
- **Refresh strategy**: Auto-refresh in background before expiry

---

## Phase 3: Cross-Domain Ready

### What Changes
- Apps can be on different domains
- Cookie no longer needed for auth (token in header always)
- CORS rules configured per app

### What Stays the Same
- Gateway single source of truth
- Session validation logic identical
- Token format and revocation unchanged

---

## Implementation Checklist

### Phase 1 (Active)
- [x] Gateway `/validate-session` accepts Bearer token
- [x] Auth middleware sends Authorization header + cookie
- [x] Tests pass (no regression)
- [ ] Remove debug logs from shell.js and index.ejs

### Phase 2 (Planned)
- [ ] Gateway login endpoint returns `{ accessToken, refreshToken }`
- [ ] Gateway `/refresh-token` endpoint
- [ ] Client-side token storage (localStorage)
- [ ] Client-side Authorization header injection
- [ ] Auto-refresh on expiry (background timer)
- [ ] Handle 401 responses (retry with refresh)

### Phase 3 (Future)
- [ ] Deploy apps to different domains
- [ ] Enable CORS in Gateway
- [ ] Update app configs (API endpoints become full URLs)
- [ ] Validate same-site requests still work

---

## Security Notes

### Current (Phase 1)
- HTTP-only cookie protects against XSS
- CSRF token still required for state-changing requests
- CORS not active (same origin)

### Phase 2 (With Bearer Tokens)
- Access token in header (vulnerable to XSS if stored in localStorage)
- **Mitigation**: Use sessionStorage (cleared on tab close) or in-memory
- Refresh token in HTTP-only cookie (CSRF protected)
- Implement token rotation on refresh

### Phase 3 (Cross-Domain)
- Configure CORS carefully (`Access-Control-Allow-Origin`, credentials)
- Refresh token rotation mandatory
- Consider short-lived access tokens (5 min)
- Implement logout across all domains

---

## Testing Strategy

### Unit Tests
- Gateway `/validate-session` with Bearer token
- Token parsing from headers
- Token refresh logic

### Integration Tests
- Client flows (login → token storage → API call → auto-refresh)
- Logout invalidates both tokens
- Expired token → 401 → refresh → retry

### End-to-End (Phase 3)
- Apps on subdomain `auth.pedaco.pt`, `mapas.pedaco.pt`
- Token shared across domains
- CORS validation

---

## Files to Update (Roadmap)

### Phase 1 (Done)
- `gateway/src/controllers/auth.controller.js` → parseSessionToken + Bearer support
- `auth/src/middlewares/auth.middleware.js` → send Authorization header

### Phase 2
- `gateway/src/routes/auth.routes.js` → add `/refresh-token` route
- `gateway/src/services/AuthService.js` → refreshToken logic
- `gateway/src/daos/SessionDAO.js` → refresh token management
- All app login forms → handle access/refresh tokens
- All app clients → axios interceptor for Authorization + auto-refresh

### Phase 3
- `.env` files → update API URLs to full domain URLs
- Nginx config → CORS headers
- App middleware → strict CORS validation

---

## Backward Compatibility

**Phase 1 is fully backward compatible**: Cookie still works, bearer token added as option.

**Phase 2 requires client changes**: Existing HTML forms need JS to handle token storage.

**Phase 3 requires redeployment**: Apps move to different domains (no gradual rollout).

---

## Next Steps

1. Remove debug logs from auth/index.ejs and shell.js
2. Design Phase 2 token endpoints in Gateway
3. Implement refresh token database schema
4. Test token flow end-to-end
5. Document client-side integration pattern
