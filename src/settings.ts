import * as vscode from "vscode";

const get = <T extends keyof ExtensionSettings>(name: T) =>
  <ExtensionSettings[T]>(
    vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor").get(name)
  );

const set = async <T extends keyof ExtensionSettings>(
  name: T,
  value: ExtensionSettings[T]
) =>
  await vscode.workspace
    .getConfiguration("siebelScriptAndWebTempEditor")
    .update(name, value, vscode.ConfigurationTarget.Global);

const refresh = <T extends keyof ExtensionSettings>(name: T) => {
  settings[name] = get(name);
  return name === "connections" || name === "maxPageSize";
};

export const settings: ExtensionSettings = {
  ...vscode.workspace.getConfiguration().get("siebelScriptAndWebTempEditor")!,
};

export const getConfig = (name: string) => {
  for (const connection of settings.connections) {
    if (connection.name === name) return connection;
  }
  return <Config>{};
};

export const setConfigs = async (configs: Config[]) =>
  await set("connections", configs);

export const configChange = (e: vscode.ConfigurationChangeEvent) => {
  if (!e.affectsConfiguration("siebelScriptAndWebTempEditor")) return false;
  for (const name of <(keyof ExtensionSettings)[]>Object.keys(settings)) {
    if (e.affectsConfiguration(`siebelScriptAndWebTempEditor.${name}`))
      return refresh(name);
  }
};
