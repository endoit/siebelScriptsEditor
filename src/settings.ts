import * as vscode from "vscode";

const get = <T extends keyof AllSettings>(name: T) =>
  <AllSettings[T]>(
    vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor").get(name)
  );

const set = async <T extends keyof AllSettings>(
  name: T,
  value: AllSettings[T]
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

export const setDefaultConnection = async (name: string) =>
  await set("defaultConnectionName", name);

export const configChange = (e: vscode.ConfigurationChangeEvent) => {
  if (!e.affectsConfiguration("siebelScriptAndWebTempEditor")) return false;
  for (const name of <(keyof ExtensionSettings)[]>Object.keys(settings)) {
    if (e.affectsConfiguration(`siebelScriptAndWebTempEditor.${name}`))
      return refresh(name);
  }
};

export const moveDeprecatedSettings = async () => {
  try {
    const oldConnections = get("REST EndpointConfigurations"),
      configs = settings.connections;
    if (!oldConnections || configs.length !== 0) return;
    const workspaces = get("workspaces") ?? [],
      workspaceObject: Record<string, string[]> = {},
      [defaultConnectionName = "", defaultWorkspace = ""] =
        get("defaultConnection")?.split(":") ?? [];
    let defaultConnection: string | undefined;
    for (const workspace of workspaces) {
      const [name, workspaceString] = workspace.split(":");
      workspaceObject[name] = workspaceString ? workspaceString.split(",") : [];
    }
    for (const config of oldConnections) {
      const [connUserPwString, url] = config.split("@"),
        [name, username, password] = connUserPwString?.split("/"),
        connection = {
          name,
          username,
          password,
          url,
          workspaces: workspaceObject[name] ?? [],
          restWorkspaces: false,
          defaultWorkspace: workspaceObject[name]?.[0] ?? "",
        };
      configs.push(connection);
      if (name !== defaultConnectionName) continue;
      if (!workspaceObject[name].includes(defaultWorkspace)) continue;
      connection.defaultWorkspace = defaultWorkspace;
      defaultConnection = name;
    }
    defaultConnection ??= configs[0]?.name ?? "";
    await setConfigs(configs);
    await setDefaultConnection(defaultConnection);
    await set("REST EndpointConfigurations", undefined);
    await set("workspaces", undefined);
    await set("defaultConnection", undefined);
    await set("getWorkspacesFromREST", undefined);
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please create connections manually!`
    );
  }
};
