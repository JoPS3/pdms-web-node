# Authentication & Service Communication Architecture

## Overview

The PDMS authentication model is token-pure for protected app access.

1. The official auth pair is `accessToken + refreshToken`.
2. Browser flows use HttpOnly cookies managed by the gateway.
3. Inter-service flows use `Authorization: Bearer <accessToken>`.
4. Optional refresh fallback between services uses `X-Refresh-Token`.
5. `sessionStorage` is not part of the active contract.

## Browser Contract

### Login

1. `POST /login` validates the username and selects the next step.
2. `POST /verify-password` or `POST /set-password` completes authentication.
3. The gateway sets `pdms_access_token` and `pdms_refresh_token` as HttpOnly cookies.
4. The browser proceeds to `/apps` without any client-side token storage.

### Protected Navigation

1. Browser requests `/apps` or `/apps/<app>` through the gateway.
2. Gateway reads `pdms_access_token`.
3. If the access token is invalid and `pdms_refresh_token` exists, gateway refreshes automatically.
4. If refresh succeeds, gateway updates cookies and continues.
5. If refresh fails, gateway clears cookies and redirects to login.

### Logout

1. `POST /logout` invalidates the current session in the database.
2. Gateway clears auth cookies.

## Service-to-Service Contract

### Required Header

`Authorization: Bearer <accessToken>`

### Optional Header

`X-Refresh-Token: <refreshToken>`

Use the optional refresh header only when the caller wants the gateway to attempt refresh during `GET /validate-session`.

## Proxy Contract

When a browser request enters through `/apps/<app>`, the gateway validates the user and proxies the request with:

1. `Authorization: Bearer <accessToken>`
2. `X-Gateway-User-Id`
3. `X-Gateway-User-Name`
4. `X-Gateway-User-Email`
5. `X-Gateway-User-Role`
6. `X-Gateway-User-Role-Id`

Downstream apps should trust these headers as the fast path for proxied traffic.

## Direct App Access Fallback

When an app receives a request directly, without `X-Gateway-User-*` headers:

1. Read `Authorization: Bearer <accessToken>`.
2. Call `GET <gatewayBasePath>/validate-session`.
3. Optionally send `X-Refresh-Token` if refresh fallback is desired.
4. Build the local authenticated user from the gateway response.

## Temporary Bootstrap Session

`connect.sid` may still exist only for the temporary two-step login bootstrap (`tempUser`).
It is not the contract for protected app access.

## Summary

1. Browser auth state lives in gateway-managed HttpOnly cookies.
2. Protected app access is token-based, not session-based.
3. Refresh is server-driven in the gateway.
4. Direct module communication stays Bearer-first.
5. Any documentation or code path based on `sessionStorage` should be treated as legacy.
