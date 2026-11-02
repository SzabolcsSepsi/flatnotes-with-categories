# Maintenance and updates

The repository maintainer owns upstream integration and security response.
GitHub Actions runs tests and advisory checks on pushes, pull requests and daily
at 07:17 UTC. A read-only release check fails when the latest original Flatnotes
release differs from UPSTREAM.json. Dependabot proposes weekly npm, uv, Docker
and Actions updates. Neither process deploys or auto-merges code.

Enable Actions on this fork, enable Dependabot alerts and security updates, and
subscribe to Actions failures in GitHub's notification settings. Verify the daily
workflow actually runs on the default branch; workflow files alone do not prove
notifications reach an operator. GitHub may disable scheduled workflows after
extended repository inactivity. Check that monitoring remains active monthly.
Follow upstream security notices as well as releases. Public notifications and
CI logs must contain source/test metadata only, never real notes or secrets.

## Routine

1. Triage security notifications promptly. Weekly dependency proposals are not a
   reason to postpone an applicable serious fix. Restrict access if a serious
   issue cannot be corrected promptly. Review applicability, not severity alone.
2. Create an update branch from the maintained default branch. Fetch the original
   repository as an **upstream** remote. Review an exact release commit and its
   signature/provenance; do not blindly replace the default branch with upstream.
3. Merge upstream into the update branch. Consult PATCH_MAP.md for our changes.
   Keep the extension files separate, and resolve changes in auth, routing,
   rendering and dependencies deliberately. Recheck all access boundaries.
4. Preserve lockfiles. Make targeted updates within compatible constraints;
   review major/transitive overrides individually. The DOMPurify override upgrades
   an existing sanitizer used by the editor. Glob/minimatch overrides fix existing
   build-tool advisories. Remove overrides only after the parent dependency safely
   carries equivalent fixes. Do not remove them merely to resolve a merge.
5. Refresh official container digests with
   `uv run --no-sync python scripts/refresh_base_images.py`. Review Dockerfile and
   the upstream uv tag before changing the script's pinned tool version. Digest
   pinning requires regular refresh; an old pinned image can remain vulnerable.
6. Run the complete CI sequence in .github/workflows/security-and-tests.yml.
   Tests use synthetic data and no deployment secrets. New advisory findings,
   expired applicability reviews and failing boundaries block readiness.
7. Update UPSTREAM.json only when the release has actually been integrated and
   tested. Record release/commit, dependency changes and tests in the update PR.
   Obtain review, then merge. Do not force-push or auto-merge security updates.
8. Build a versioned image for the tested commit, record its image digest, and
   keep the previous tested image available. Deployment is a separate operator
   action. Take a protected restorable data snapshot first; test restoration.

## Local security checks

```sh
npm audit --audit-level=low
uvx --from pip-audit==2.10.1 pip-audit --path .venv/lib/python3.13/site-packages --format json --output .qa/python-audit.json
uv run --no-sync python scripts/check_python_audit.py .qa/python-audit.json
```

Create .qa first. On Windows the path is `.venv/Lib/site-packages`. pip-audit exits
1 for findings; still run the report checker. The checker accepts only documented,
version-scoped, expiring applicability exceptions and rejects new/changed findings.
There are two flagged Python packages; a passing applicability check is not a
zero-advisory claim. If the installed package list or scan is incomplete, fail the
check rather than treating missing data as success.

The daily workflow uses read-only repository permissions, immutable Action commit
pins and no deployment credentials. Keep external tools and Actions updated too.
PRs, including dependency PRs, must run tests before merging. Configure the Security
and tests job as a required branch check where supported; one-person review cannot
be represented as independent human approval. Never use pull_request_target to
execute untrusted branch code with privileged credentials.
It also starts the built container with synthetic data, scans source using a
checksum-pinned Gitleaks binary, and scans patchable HIGH/CRITICAL OS findings
using a digest-pinned Trivy image without exposing the Docker socket. Unfixed OS
findings and lower-severity OS findings are outside that blocking scan; review
them separately when assessing deployment risk. Node/Python package checks are
separate. Update the pinned scanner/tool versions and checksum records as part
of maintenance; Dependabot's Docker ecosystem monitors Dockerfile images, not
arbitrary scanner references embedded in workflow shell commands.

## Rollback

Switch back to the previous tested image if the new build fails. The sidebar and
task views perform no storage migration; Contents and Home remain ordinary notes.
Do not restore an old data snapshot merely to roll back code, because that could
overwrite newer notes. A rollback also rolls back security fixes: if the previous
image is vulnerable, restrict exposure until a corrected build is ready.

Baseline flat-file storage is intended for one application instance. This fork
does not introduce collaborative editing or multi-writer coordination.
