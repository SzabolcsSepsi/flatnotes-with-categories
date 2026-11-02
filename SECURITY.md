# Security scope and reporting

Report vulnerabilities privately through this repository's GitHub Security
Advisories page when available. Do not put note contents, credentials or working
exploit targets into public issues. A public repository does not imply that a
running instance or its notes should be public.

The extension adds no server endpoints, filesystem navigation, share links or
runtime feature libraries. The category menu and task/calendar views use the
existing authenticated note API and plain-text Vue bindings. The Python backend,
editor and dependency chain still require maintenance and security review.

## Hardening included

- Client errors do not log whole request/response objects.
- Logout/session invalidation clears browser drafts and in-memory extension data.
  Stale requests must not revive old content or invalidate a newer session.
- Navigation away from unsaved edits requires confirmation.
- Active or unknown attachment formats download as binary, with nosniff and a
  sandbox policy. Only PNG/JPEG/GIF/WebP are served inline as fixed image types.
- Responses use no-store, nosniff and no-referrer headers. Note/index logs omit
  document filenames and paths. Uvicorn access logging redacts request targets.
- Normal TOTP startup never prints the reusable enrolment secret. Provision it
  deliberately offline: the existing implementation uses Base32 of the UTF-8
  FLATNOTES_TOTP_KEY value, with account issuer flatnotes. Keep enrolment output
  outside application/proxy logs and shared terminals.
- Filename validation rejects control characters and oversized UTF-8 names.
- Existing dependency security fixes and immutable container/Action pins are
  tracked separately from feature changes. No custom cryptography is introduced.

## Deployment responsibilities

Use HTTPS and appropriate MFA/access protection. password and totp protect access;
none and read_only do not make data private. Apply login-attempt limits at the
existing gateway. Protect every API/attachment alias and prevent direct origin-port
bypass. Do not publish the data directory, environment file, backups or index as
static content. Keep public /api/config quick-access labels and queries generic.
No per-person or per-category permissions are added by this fork.
The container no longer trusts forwarded headers from every address. Set the
Uvicorn FORWARDED_ALLOW_IPS environment setting only to the actual trusted proxy
addresses when needed; do not use a wildcard on an exposed origin.
Static assets are no longer world-writable. The default container UID is 1000;
the root entrypoint adjusts only index.html ownership for a custom PUID before
dropping privileges. A custom non-root --user must have write access to that
file for the existing base-URL initialisation, or use a suitably prepared image.

Use a private, independently random symmetric FLATNOTES_SECRET_KEY of at least
32 bytes. No public keys, PEM/DER keys, JWKs or external JWKS belong in that setting.
Choose an appropriate FLATNOTES_SESSION_EXPIRY_DAYS. JWTs already copied by an
attacker remain valid until expiry or secret rotation; logout is local cleanup,
not server-side token revocation. Tokens remain JavaScript-readable as upstream.

Browser drafts remain an upstream feature: with Remember Me they can be stored
locally; otherwise they live in session storage. Logout/invalid-session cleanup
clears both stores. Use protected devices and avoid Remember Me where local
persistence is undesirable. Ordinary note images/links may contact external
sites; only the new navigation/task views are text-only and add no such requests.

Protect all Markdown files, uploads, search index and backups. Verify backup
coverage and restoration, not just that a backup job runs. Disk encryption does
not prevent a compromised running application from reading data. No end-to-end
encryption or independent production penetration-test certification is claimed.

## Known advisory applicability

`security/advisory-exceptions.json` records two inherited, unpatched advisories
whose affected operations are not used by this application configuration:

- ecdsa / CVE-2024-23342 affects EC signing, key generation and ECDH. This app uses
  HS256 and performs none of those operations.
- python-jose / CVE-2026-85394 concerns asymmetric public-key material accepted as
  an HMAC secret. This app uses a private random symmetric secret and explicitly
  restricts verification to HS256. The private-secret requirement is essential.

The applicability checks expire on 2027-01-31 and are tied to exact versions and
JWT call-site assertions. Tests reject wrong-secret, none and asymmetric-algorithm
tokens. Any auth/key/algorithm/dependency change requires a fresh assessment.
These packages are still flagged by scanners; neither vulnerability is claimed
fixed. Newly discovered findings fail the checks and require review.
