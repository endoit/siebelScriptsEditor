import * as vscode from "vscode";
import {
  CONFIG_DATA,
  CONNECTION,
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  ERR_NO_CONN_SETTING,
  OBJECT,
  REST_WORKSPACES,
  SERVICE,
  WORKSPACE,
} from "./constants";
import { getWorkspaces } from "./dataService";

export interface GlobalState extends vscode.Memento {
  get(key: "connection" | "workspace" | "workspaceFolder"): string;
  get(key: "object"): SiebelObject;
  get(key: "interceptor"): number;
  get(key: "newConnection"): boolean;
  get(key: "restWorkspaces"): string[];
}

//create url path from parts
export const joinUrl = (...args: string[]) => args.join("/");

//open the configure connections webview
export const configureConnection = () =>
  vscode.commands.executeCommand("siebelscriptandwebtempeditor.config");

//open the extension settings
export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

//get the settings
export const getSetting: IGetSetting = <T extends keyof Settings>(
  settingName: T
) =>
  vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")[
    settingName
  ] as unknown as Settings[T];

//set the settings
export const setSetting = async <T extends keyof Settings>(
  settingName: T,
  settingValue: Settings[T]
) =>
  await vscode.workspace
    .getConfiguration()
    .update(
      `siebelScriptAndWebTempEditor.${settingName}`,
      settingValue,
      vscode.ConfigurationTarget.Global
    );

export const getConnection = (name: string) =>
  getSetting(CONNECTIONS).find((item) => item.name === name) || {} as Config;

//parse the configurations
export const refreshState = async (globalState: GlobalState) => {
  const connections = getSetting(CONNECTIONS),
    defaultConnectionName = getSetting(DEFAULT_CONNECTION_NAME);
  try {
    if (connections.length === 0) throw new Error(ERR_NO_CONN_SETTING);
    const name = connections.some((item) => item.name === defaultConnectionName)
        ? defaultConnectionName
        : connections[0].name,
      connection = getConnection(name);
    globalState.update(CONNECTION, name);
    if (connection.restWorkspaces) {
      const restWorkspaces = getWorkspaces(connection);
      globalState.update(REST_WORKSPACES, restWorkspaces);
    }
    globalState.update(
      WORKSPACE,
      connection.defaultWorkspace || connection.workspaces[0]
    );
    globalState.update(OBJECT, SERVICE);
  } catch (err: any) {
    globalState.update(CONNECTION, "");
    globalState.update(CONFIG_DATA, {});
    vscode.window.showErrorMessage(err.message);
  }
};

//copy the deprecated settings if they exist to the new setting
export const moveDeprecatedSettings = async () => {
  const {
      "REST EndpointConfigurations": connectionConfigs,
      workspaces,
      defaultConnection,
      connections,
    } = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ) as unknown as Settings & OldSettings,
    newConnections: Settings["connections"] = [],
    workspaceObject: Workspaces = {};
  let isDefault = false;
  try {
    if (!connectionConfigs || !(Object.keys(connections).length === 0)) return;
    const [defaultConnectionName = "", defaultWorkspace = ""] =
      defaultConnection?.split(":") || [];

    for (const workspace of workspaces) {
      const [name, workspaceString] = workspace.split(":");
      workspaceObject[name] = workspaceString ? workspaceString.split(",") : [];
    }

    for (const config of connectionConfigs) {
      const [connUserPwString, url] = config.split("@"),
        [name, username, password] = connUserPwString?.split("/"),
        connection = {
          name,
          username,
          password,
          url,
          workspaces: workspaceObject[name] ?? [],
          restWorkspaces: false,
          defaultWorkspace: workspaceObject[name][0] ?? "",
        };

      if (
        name === defaultConnectionName &&
        workspaceObject[name].includes(defaultWorkspace)
      ) {
        connection.defaultWorkspace = defaultWorkspace;
        isDefault = true;
      }
      newConnections.push(connection);
    }
    await setSetting(CONNECTIONS, newConnections);
    await setSetting(
      DEFAULT_CONNECTION_NAME,
      isDefault ? defaultConnectionName : newConnections[0].name
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please check and fill the new settings manually!`
    );
  }
};
