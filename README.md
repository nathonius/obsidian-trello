# Obsidian Trello Plugin

## Overview

Connect a single Trello card to an Obsidian note. Once connected, see basic info, and add and view comments.

The connection is through a YAML frontmatter key.

## Setup

Before you can connect a Trello card, you need to create an API token and set it in the plugin settings. You can create a token [here][tokenurl]; make sure to copy it before closing the tab.

Tokens can be revoked at any time in your Trello account settings.

### Optional Settings

**Select Boards** - Filter the boards available to select cards from. If none are selected, all boards will be available.

**Open to Side** - Whether to open the Trello view to the left or right by default.

## Commands

**Show Trello view** - Open the Trello pane, if it isn't already.

**Connect Trello card** - Connect a note to a (new) Trello card.

**Disconnect Trello card** - Remove the Trello connection from a note.

## Support

Feel free to contact me on the Obsidian discord, @OfficerHalf.

[tokenurl]: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Obsidian%20Trello%20Token&key=9537467993aefd6dca9ee7788179c298
