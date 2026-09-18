# Security and operations notes

## Implemented controls

- Short-lived JWT access tokens and rotating, revocable refresh sessions in an HTTP-only cookie
- Separate API and authentication rate limits
- Login-success and login-failure security events
- One-time, expiring password-reset tokens; completing a reset revokes refresh sessions
- Permission checks for files, notifications, security reports, data export and branch operations
- Automatic audit entries for successful API mutations, with a SHA-256 forward hash chain
- Organization-scoped data export and branch-scoped attachment access
- File type, size, generated-path and content-disposition controls for uploads
- Helmet security headers and an explicit CORS origin

## Secret review

- `.env` is ignored by Git.
- The tracked repository was scanned for the development MongoDB credential and Atlas connection strings; no match was found.
- The password previously shared in chat must still be rotated before deployment.
- Production must set `NODE_ENV=production`, a strong unique `JWT_SECRET`, the restricted Atlas URI and the exact HTTPS web origin.

## Validation performed

- TypeScript validation across all workspaces
- API authorization smoke tests
- Branch tenant-filter tests
- API rate-limit test
- Production dependency audit (`0` known production vulnerabilities on 18 September 2026)
- Production build and live browser verification

The broader end-to-end, backup/restore, device, offline and business-acceptance tests remain part of package 23.
