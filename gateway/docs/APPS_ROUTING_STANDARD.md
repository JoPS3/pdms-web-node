# Apps Routing Standard

## Overview

All applications in PDMS are routed through a **centralized proxy pattern** in the gateway service. This ensures:
- ✅ Consistent authentication across all apps
- ✅ Unified token management
- ✅ Single entry point for all services
- ✅ Easy addition of new apps

## Current Structure

**File**: `gateway/src/routes/apps-proxy.routes.js`

All app routes are centralized in this single file:

```
GET /apps              → List available apps
GET /mapas/*           → Proxy to mapas service (port 6002)
GET /vendas/*          → Proxy to vendas service (port 6003)
GET /compras/*         → Proxy to compras service (port 6004)
GET /rh/*              → Proxy to rh service (port 6005)
```

All routes require authentication via `requireAuth` middleware.

## Port Convention

Each app runs on a dedicated port in development:

| App | Port | Env Var | Default |
|-----|------|---------|---------|
| mapas | 6002 | `MAPAS_PORT_DEV` | 6002 |
| vendas | 6003 | `VENDAS_PORT_DEV` | 6003 |
| compras | 6004 | `COMPRAS_PORT_DEV` | 6004 |
| rh | 6005 | `RH_PORT_DEV` | 6005 |

## Adding a New App

### Step 1: Add to Port Convention

1. Assign a new port following the sequence (e.g., 6006 for next app)
2. Update `apps-proxy.routes.js` `ports` object:

```javascript
const ports = {
  // ... existing apps
  newapp: process.env.NEWAPP_PORT_DEV || 6006
};
```

### Step 2: Add to Apps Array

Update the `apps` array in `apps-proxy.routes.js`:

```javascript
const apps = ['mapas', 'vendas', 'compras', 'rh', 'newapp'];
```

The routing loop automatically creates:
```
GET /newapp/* → Proxy to http://localhost:6006
```

### Step 3: Add to Apps List

Update `gateway/src/config/apps.js` to include the app in the apps list:

```javascript
{
  id: 'newapp',
  name: 'New App',
  description: 'Description of the app',
  icon: '🎯',
  url: byEnvOrDefault('APP_NEWAPP_URL_DEV', '/newapp')
}
```

### Step 4: Environment Configuration (Production)

Add to `.env` for production deployment:

```bash
NEWAPP_URL=https://newapp.example.com
NEWAPP_PORT_DEV=6006
```

## Implementation Pattern

All apps **must**:

1. ✅ Listen on their assigned port
2. ✅ Support being accessed via `http://localhost:<port>/` in dev
3. ✅ Handle authentication via token in `Authorization` header
4. ✅ Implement their own routes (the gateway only proxies)
5. ✅ Use the same token-client pattern for token management

## Token Integration

All apps share the same token management:

1. **Token Client**: `gateway/src/public/scripts/token-client.js`
2. **Storage**: `sessionStorage` (cleared on tab close)
3. **Auto-Refresh**: Automatic refresh 5 minutes before expiry
4. **Error Handling**: Auto-refresh on 401 responses

## Example: Complete Checklist for New App

```
□ Create app in /path/to/app
□ Configure port in .env (e.g., NEWAPP_PORT_DEV=6006)
□ Add to apps-proxy.routes.js ports object
□ Add to apps array in apps-proxy.routes.js
□ Add to apps.js config/apps.js list
□ Implement auth middleware to validate Bearer token
□ Test via http://localhost:6000/pdms-new/newapp/
□ Verify token auto-refresh works
□ Add .env production URL
```

## Benefits of This Pattern

- 🔐 **Single Auth Gateway**: All authentication flows through one point
- 📊 **Monitoring**: Centralized logging and metrics
- 🔄 **Token Management**: Shared token lifecycle
- 🚀 **Scalability**: Easy to add apps without modifying multiple files
- 📝 **Consistency**: All apps follow the same routing pattern

## Related Files

- `gateway/src/routes/apps-proxy.routes.js` - Centralized proxy configuration
- `gateway/src/config/apps.js` - Apps metadata and URLs
- `gateway/src/public/scripts/token-client.js` - Client-side token management
- `gateway/src/middlewares/auth.middleware.js` - Authentication enforcement
