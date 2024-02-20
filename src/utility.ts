import * as vscode from "vscode";
import {
  CONFIG_DATA,
  CONNECTION,
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  ERR_NO_CONN_SETTING,
  OBJECT,
  SERVICE,
  WORKSPACE,
  MAX_PAGE_SIZE
} from "./constants";

export interface GlobalState extends vscode.Memento {
  get(key: "connection" | "workspace" | "workspaceFolder"): string;
  get(key: "object"): SiebelObject;
  get(key: "interceptor"): number;
}

//create url path from parts
export const joinUrl = (...args: string[]) => args.join("/");

//open the configure connections webview
export const configureConnections = () =>
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

//parse the configurations
export const initState = async (globalState: GlobalState) => {
  const connections = getSetting(CONNECTIONS),
    defaultConnectionName = getSetting(DEFAULT_CONNECTION_NAME);
  try {
    if (Object.keys(connections).length === 0)
      throw new Error(ERR_NO_CONN_SETTING);
    console.log({ connections });
    globalState.update(CONNECTION, defaultConnectionName);
    globalState.update(
      WORKSPACE,
      connections[defaultConnectionName].defaultWorkspace
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
    connectionsSetting: Settings["connections"] = {},
    workspaceObject: Workspaces = {};
  let isDefault = false;
  try {
    if (!connectionConfigs || !(Object.keys(connections).length === 0)) return;
    const [defaultConnectionName = "", defaultWorkspace = ""] =
      defaultConnection?.split(":") || [];

    for (const workspace of workspaces) {
      const [connectionName, workspaceString] = workspace.split(":");
      workspaceObject[connectionName] = workspaceString
        ? workspaceString.split(",")
        : [];
    }

    for (const config of connectionConfigs) {
      const [connUserPwString, url] = config.split("@"),
        [connectionName, username, password] = connUserPwString?.split("/");
      connectionsSetting[connectionName] = {
        username,
        password,
        url,
        workspaces: workspaceObject[connectionName] ?? [],
        restWorkspaces: false,
        defaultWorkspace: workspaceObject[connectionName][0] ?? "",
      };
      if (
        connectionName === defaultConnectionName &&
        workspaceObject[connectionName].includes(defaultWorkspace)
      ) {
        connectionsSetting[connectionName].defaultWorkspace = defaultWorkspace;
        isDefault = true;
      }
    }
    await setSetting(CONNECTIONS, connectionsSetting);
    await setSetting(
      DEFAULT_CONNECTION_NAME,
      isDefault ? defaultConnectionName : Object.keys(connectionsSetting)[0]
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please check and fill the new settings manually!`
    );
  }
};
