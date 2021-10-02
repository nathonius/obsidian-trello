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
