import { TrelloPlugin } from './plugin';

export const migrations: Record<string, (plugin: TrelloPlugin) => void> = {
  '1.0.0': v1_0_0,
  '1.1.0': v1_1_0,
  '1.2.0': v1_2_0,
  '1.3.0': v1_3_0
};

/**
 * How migrations work:
 * Each function should take all the necessary steps to migrate from
 * that version (ex: 1.0.0) to the current version. If there are new
 * features added or breaking changes made, ALL previous migration
 * methods should be updated.
 *
 * At the very least, the version data should be updated to the
 * current version so that migrations are only executed once.
 */

function v1_0_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}

function v1_1_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}

function v1_2_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}

function v1_3_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}
