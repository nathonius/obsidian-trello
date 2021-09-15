import { TrelloPlugin } from './plugin';

export const migrations: Record<string, (plugin: TrelloPlugin) => void> = {
  '1.0.0': v1_0_0,
  '1.1.0': v1_1_0,
  '1.2.0': v1_2_0
};

function v1_0_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}

function v1_1_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}

function v1_2_0(plugin: TrelloPlugin): void {
  plugin.state.updateVersion();
}
