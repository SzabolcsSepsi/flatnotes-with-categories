# Hierarchical navigation and dated tasks

This fork adds a small table-of-contents sidebar and date-sorted task views to
[Flatnotes](https://github.com/dullage/flatnotes). The editor and full-text search
remain the original application. No runtime libraries or server endpoints were
added for these features. Playwright is a development-only browser test runner.

## Organise the sidebar

Create an ordinary note titled **Contents** using the existing editor:

```markdown
# Contents
## Projects
- [[Overview]]
### Reference
- [[Reading list]]
- [[Guide]]
## Ideas
- [[Next steps]]
```

Headings become expandable categories; standalone bulleted wikilinks open notes.
Change the menu by editing Contents, then use Refresh contents if needed. The
menu also refreshes after a save and navigation. Markdown and WYSIWYG modes are
supported. Native keyboard controls operate the expandable categories.

This is a manually curated menu. Files remain in Flatnotes' flat Markdown
directory, with unique note titles. Adding or renaming a document may require
updating its Contents link. A note can appear under several categories. Search
all notes also finds notes that are not listed in Contents.

Only headings and standalone note links are interpreted by the sidebar. HTML,
external URLs, embedded content, link aliases and anchors are not navigation
instructions. Invalid links are skipped. Input is bounded to 256 KiB, 2,000 menu
entries and six heading levels. Keep titles within the documented filename rules.

## Home and tasks

Create an ordinary note titled **Home**. It can contain any overview text and
dated tasks:

```markdown
# Home
- [ ] 2026-12-15 — Read the next chapter
- [ ] 2026-11-20 — Update the reading list
- [x] 2026-11-01 — Finish the introduction
```

Tasks by date displays valid dated entries earliest first, preserving the original
Home note. Equal dates retain their source order. Completed tasks are hidden by
default and can be shown. Invalid dates and undated entries remain in the note
but are omitted from this view. Use YYYY-MM-DD; task text is displayed literally.

Month view is a read-only calendar of the same entries. Add or edit entries in
Home, using the normal editor; no separate event database exists. Dates represent
calendar days, with no time-zone conversion, reminders, recurrence or sync.

Existing Home or Contents notes are never replaced, and missing notes are never
created automatically. Inspect any pre-existing note before adopting the naming
convention. If either is renamed, restore its original title or recreate it
deliberately through the normal editor. No recovery or migration runs implicitly.

## Build and checks

Use Node 24, Python 3.13 and uv 0.13.6:

```sh
npm ci --ignore-scripts
uv sync --locked --no-dev
npm test
npm run build
uv run --no-sync python scripts/check_boundaries.py
uv run --no-sync python tests/security_smoke.py
npx playwright install chromium
uv run --no-sync python tests/run_browser.py
```

The tests create disposable synthetic data and loopback-only servers. Do not
substitute an existing data directory. Browser checks use downloaded Chromium,
or an explicit installed browser through TEST_BROWSER. See MAINTENANCE.md for
the repeatable dependency scan, update and rollback process.

## Run the fork

Build this repository's Dockerfile instead of installing the original Flatnotes
image, which does not include the extension:

```sh
docker build --pull -t flatnotes-local:reviewed .
```

Provide FLATNOTES_USERNAME, FLATNOTES_PASSWORD and FLATNOTES_SECRET_KEY using
your operator's secret-management process. Generate a private symmetric secret
with at least 32 random bytes, for example with Python secrets.token_urlsafe(48).
Never use a public key as this secret. The runtime rejects short and PEM-shaped
secrets. Select password or totp authentication; none and read_only are public
modes. Configure HTTPS, access controls and backups before network exposure.
See SECURITY.md for deployment boundaries and inherited advisory qualifications.
