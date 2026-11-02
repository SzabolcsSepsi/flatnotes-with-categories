# Hierarchical navigation and dated tasks

This fork adds a small table-of-contents sidebar and date-sorted task views to
[Flatnotes](https://github.com/dullage/flatnotes). The editor and full-text search
remain the original application. No runtime libraries or server endpoints were
added for these features. Playwright is a development-only browser test runner.

## Organise the sidebar

Use **Add category** in the sidebar, enter a name and choose its parent (or
**Top level**), then select **Create category**. The small folder-plus button beside
a category adds a subcategory there directly. Categories expand and collapse.

Use **Add note**, or the file-plus button beside a category, to choose between:

- **Create new note**: creates a blank note, adds it to the chosen category and
  opens it in the existing editor immediately.
- **Link existing note**: adds a note by its exact title, preserving its contents.

The first confirmed addition creates the ordinary **Contents** note if it is
missing. Opening or cancelling a form does not create anything. There is no
Markdown setup to learn. Categories and note links are stored in that note;
the pencil button opens it for optional advanced editing, reordering or removing
menu entries. For example, this is the equivalent Markdown:

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
The controls preserve existing source, including extra text and code examples.
The menu refreshes after a save and navigation; the refresh icon reloads it on
demand. Optional direct editing supports Markdown and WYSIWYG modes. Native
keyboard controls operate categories, forms and links. Creating a category is
limited to six heading levels; use plain names without HTML or link brackets.

Files remain in Flatnotes' flat Markdown directory, with unique note titles.
Notes created using the sidebar are linked automatically. Notes created through
the original New Note button can be added using Link existing note. Renaming a
document may require updating its Contents link. A note can appear under several
categories. Search also finds notes that are not listed in Contents.

Sidebar writes pause while Contents is being edited, and its editor pauses while
a sidebar save is in progress. The controls re-read Contents before writing and
refuse a stale selection. This is not an atomic multi-writer transaction. If a
new note is created but its menu update fails, it remains searchable; refresh and
choose Link existing note to add it. No existing note is overwritten or deleted
as recovery. A duplicate title requires an explicit choice to link that note.

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

Existing Home notes are never replaced. Existing Contents source is preserved
when adding entries; missing Contents is created only on an explicit confirmed
sidebar addition. Missing Home is never created automatically.
Inspect any pre-existing note before adopting the naming
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
