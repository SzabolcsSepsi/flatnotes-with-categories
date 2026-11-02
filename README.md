# Flatnotes with categories

A small, self-hosted extension of [Flatnotes](https://github.com/dullage/flatnotes)
for people who like simple Markdown notes and want a clearer overview as their
collection grows. Keep the original editor and full-text search, and add a
clickable hierarchy, a Home note and an easy way to see dated tasks.

> **IMPORTANT: NO COMMITMENT TO ONGOING MAINTENANCE OR REGULAR UPDATES.**
> This free source-code fork is provided **AS IS**. Do not rely on its authors,
> contributors or maintainers to keep it updated, monitor vulnerabilities, provide
> support or supply security fixes within any period. **You decide whether to
> download, run and expose it, and you are responsible for operating and updating
> your installation.** Warranty and liability exclusions apply only within the
> limits permitted by applicable law. Read the full [notice](NOTICE.md), including
> its mandatory-liability exceptions, before using or distributing the software.

## What this fork adds

| Feature | How it works | Why it can be useful |
| --- | --- | --- |
| Hierarchical sidebar | Expandable categories and subcategories with clickable note links | Browse related material without remembering every title or search term |
| Add category | Create a category directly in the sidebar and choose its parent | Organise a growing collection through simple controls |
| Add note | Create a note inside a category and open the existing editor immediately | Start writing in the right place |
| Link existing note | Add an existing note to one or several categories without changing its content | Build several useful views of the same material |
| todo | Sidebar shortcut to the ordinary editable Home note | Keep an overview, links and a short to-do list together |
| Tasks by date | A chronological view of dated checkbox entries in Home | See upcoming tasks in order while keeping the original note editable |
| Month view | A small read-only calendar derived from those same dated entries | See which days contain tasks at a glance |

Navigation is stored in an ordinary **Contents** Markdown note. The sidebar
controls maintain it for you; direct editing remains available when wanted.
Your documents stay in Flatnotes' flat Markdown directory with unique titles.
The categories are a navigation hierarchy, rather than physical filesystem
folders. Search finds all notes, including those outside the menu.

The task and calendar views read dates from Home; they introduce no separate
appointment database, reminder service or synchronisation account. These features
add no runtime libraries or server endpoints. See [NOTEBOOK.md](NOTEBOOK.md) for
setup, examples and the limits of the editing controls.

## What stays familiar

- The original Markdown and WYSIWYG editor.
- Full-text search, tags and wikilinks.
- Ordinary Markdown files and existing attachment handling.
- Light and dark themes, with a responsive interface.
- The existing authentication modes and configuration model.

This is an independent fork. The upstream project does not provide these added
features or undertake support for this version. References to Flatnotes identify
its origin and do not imply endorsement.

## Run it yourself

Build this repository to get the added features. The original upstream container
image and upstream demo are separate versions.

```sh
docker build --pull -t flatnotes-local:reviewed .
```

Before starting an instance, configure a dedicated data directory, authentication
credentials and a private random signing secret. Start with a loopback-only test
instance. Follow [NOTEBOOK.md](NOTEBOOK.md) for the build requirements and
[SECURITY.md](SECURITY.md) for authentication, deployment boundaries and known
advisory qualifications. Protect and test your backups before using important
data. This repository does not supply a hosted service.

## Maintenance and security

[MAINTENANCE.md](MAINTENANCE.md) describes the available checks, upstream integration,
dependency updates and rollback procedure. [PATCH_MAP.md](PATCH_MAP.md) identifies
changes to upstream files.

Automated checks, dependency proposals, test results and past fixes are tools and
historical observations. They are **not** a promise of future monitoring, prompt
responses, continuing maintenance, compatibility or vulnerability-free software.
No support period, release schedule, response time or service-level agreement is
offered through this repository. Voluntary work may stop, subject to mandatory law.

Report suspected vulnerabilities using the private reporting route described in
[SECURITY.md](SECURITY.md); never publish credentials or private notes in reports.
There is no guaranteed response or remediation timeframe.

## Licence and attribution

The project, including the modifications in this fork, is distributed under the
[MIT License](LICENSE), except where a file or third-party component states
otherwise. The original Flatnotes copyright and permission notice is retained
unchanged. MIT permits use, modification and redistribution, including commercial
use, subject to its notice requirements. This release is provided free of charge;
that does not restrict downstream users' MIT rights.

Dependencies, fonts and other third-party materials retain their own licences and
notice requirements. For example, Poppins is covered by the included
[SIL Open Font License](client/assets/fonts/Poppins/OFL.txt). Preserve applicable
notices when distributing source, compiled assets or container images. No right to
another party's trademarks or endorsement is granted by this description.

The [full warranty, maintenance and liability notice](NOTICE.md) applies within
mandatory legal limits. It does not remove rights that applicable law makes
non-excludable.
