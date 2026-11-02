# Changes relative to original Flatnotes

The upstream baseline is recorded in UPSTREAM.json. Retain the original MIT
license and attribution. This is an independent derivative, not an upstream
release or a claim of endorsement.

| Files | Reason |
| --- | --- |
| client/extensions/notebook/ | Bounded Contents parser/sidebar, private in-memory fetching, dated task list and small derived month view |
| client/App.vue, client/views/Home.vue | Mount the sidebar and existing Home/task navigation |
| client/views/Note.vue | Save notification, route guard, request/session cleanup; preserve existing editor |
| client/api.js, client/tokenStorage.js | Generic errors, session invalidation and draft cleanup, Secure cookie on HTTPS |
| server/helpers.py | Stricter literal filename validation |
| server/attachments/file_system/file_system.py | Safe image subset and forced download for active/unknown content |
| server/main.py, server/logger.py, server/notes/file_system/file_system.py | Private response headers and content-free logging |
| server/auth/local/local.py | No startup enrolment-secret disclosure, private-secret checks and Unicode-safe comparison |
| package.json, package-lock.json, uv.lock | Targeted security updates; Playwright is development-only |
| Dockerfile, entrypoint.sh | Pin official images/tool; normalise shell line endings; remove wildcard forwarded-header trust |
| tests/, scripts/, security/, .github/ | Repeatable tests, expiring advisory review, upstream detection and dependency updates |

Runtime dependency names and API routes are checked against upstream. Features
do not add Python packages, external services or persistent data formats.
