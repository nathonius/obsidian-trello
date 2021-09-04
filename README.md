# Obsidian Trello

![ObsidianTrello](doc/screenshot.png)

## Overview

Connect a single Trello card to an Obsidian note. Once connected, see basic info, and add and view comments. No card to connect to the note? Add a new note to a list from inside Obsidian.

The connection is through a YAML frontmatter key.

## Setup

### Prerequisites

1. A Trello account
2. The [MetaEdit](https://github.com/chhoumann/MetaEdit) Obsidian plugin (install from inside Obsidian)
   - Obsidian Trello makes use of MetaEdit's [YAML Frontmatter API](https://github.com/chhoumann/MetaEdit#api).
3. A Trello API token (see below).

Before you can connect a Trello card, you need to create an API token and set it in the plugin settings. You can create a token [here][tokenurl]; make sure to copy it before closing the tab.

Tokens can be revoked at any time in your Trello account settings.

### Optional Settings

**Select Boards** - Filter the boards available to select cards from. If none are selected, all boards will be available.

**Open to Side** - Whether to open the Trello view to the left or right by default.

**New Card Position** - Whether newly created cards should be added to the top or bottom of the list by default. Can be overridden when adding a card.

**Verbose Logging** - Enable this if you're having trouble with the plugin. Logs will be enabled in the console.

## Commands

**Show Trello view** - Open the Trello pane, if it isn't already.

**Connect Trello card** - Connect a note to a (new) Trello card. Optionally, create a new Trello card.

**Disconnect Trello card** - Remove the Trello connection from a note.

## Theming

Wherever possible, the plugin uses built-in theme variables, so your color variable overrides will apply here. The exception is the trello colors included in the plugin; these match the colors from Trello's UI. However, these can be overridden the same as Obsidian's color variables. See [variables.scss](src/variables.scss) for the full listing of colors. Each has a base shade, lighter shade, and darker shade.

## Contributing

Pull requests are always welcome. Keep in mind that this plugin makes heavy use of [rxjs](https://www.learnrxjs.io/) for reactive state management.

## Support

Feel free to contact me on the Obsidian discord, @OfficerHalf.

[tokenurl]: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Obsidian%20Trello%20Token&key=9537467993aefd6dca9ee7788179c298
