# Unreleased

## Features

- Add a **My Trello cards** view with board grouping and due-date sorting.
- Add an experimental option to link multiple Trello cards to one Markdown note.
- Add an option to keep notes linked when cards move between Trello boards.

## Security

- Validate card and board IDs read from note frontmatter before using them in Trello API paths.
- Stop verbose settings logs from including the Trello token.
- Update runtime and build dependencies to patched versions; `npm audit` reports no known vulnerabilities.

## Fixes

- Handle Obsidian being unable to provide the requested sidebar leaf.
- Prevent slower note migrations from restoring stale cards after switching files.
- Keep the primary frontmatter link and saved connection consistent when unlinking one of several cards.
- Serialize moved-card frontmatter updates and report failed writes.
- Stop retaining settings subscriptions for previously opened notes.
- Only request comments, list details, and checklists when their UI sections are enabled.
- Align the package lock and minimum Obsidian version with the 2.3.5 release metadata.

## Notes

- Additional card links use the `trello_cards` frontmatter property; the primary link remains in `trello_board_card_id` for compatibility.
- The My Trello cards view refreshes on demand and does not poll Trello in the background.

# v2.3.4

## Fixes

- Update dependencies.
- Update ESLint, rollup, and TypeScript configurations.
- Fix build errors on release.

# v2.3.3

## Fixes

- Update dependencies.

## Features

- New setting to pre-populate the description of a new trello card with the note it's being attached to. Thanks @ChrisChinchilla!

# v2.3.2

## Fixes

- Fix mysterious build loss.
- Update dependencies.

# v2.3.1

## Fixes

- Fixes bug that made due date required.

# v2.3.0

## Features

- New option to see and add card due dates. Thanks @ChrisChinchilla!

# v2.2.0

## Features

- New option to open trello links in the trello desktop apps. Thanks @ChrisChinchilla!

# v2.1.0

## Features

- New setting to pre-populate the title of a new trello card with the note it's being attached to. Thanks @ChrisChinchilla!

# v2.0.0

## BREAKING CHANGES

- Breaks compatibility with many old versions of Obsidian. Should only be used on latest versions.

## Fixes

- Prevent CORS errors by using requestUrl instead of RxJS Ajax

## Features

- MetaEdit is no longer required for use

# v1.6.1

## Fixes

- Restore compatibility with v0.15.x versions of Obsidian

# v1.6.0

## Features

- Markdown is rendered in comments, lists, and descriptions.

# v1.5.1

## Fixes

- Plugin can be enabled on mobile.

# v1.5.0

## Features

- Theme checklist progress bar to match color theme.

## Fixes

- Checklists and checklist items are sorted.
- Refreshing card bypasses checklist cache.

# v1.4.0

## Features

- Add checklist support. These can be enabled/disabled globally or per note.

## Fixes

- Force a card refresh when the token is updated. This won't fix all issues with broken tokens but does address this one case.

# v1.3.2

## Fixes

- Version 1.3.1 was incorrectly released with the wrong source files. 1.3.2 has no changes except to the version.

# v1.3.1

## Fixes

- UUIDs can be generated on mobile.

# v1.3.0

## Features

- Add global setting and per-note settings for UI customization
- Use text color variable for trello color theming
- Increase hoverable area for labels
- Hide description section when card has no description

## Fixes

- When moving cards between lists, respect the position selected in plugin settings

## Notes

- This release will add a new YAML frontmatter key to each connected file. This is used for customizing the UI for each note.

# v1.2.0

## Features

- Move cards between lists by select the current list in the Trello pane
- A new first run experience that opens the Trello pane when the plugin is first enabled

## Fixes

- New settings are properly applied to existing users.

# v1.1.0

## Features

- Create cards from within Obsidian
- Verbose logging option

# v1.0.0

## Features

- Initial release.
