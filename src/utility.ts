import * as vscode from "vscode";
import {
  CONFIG_DATA,
  CONNECTION,
  DEFAULT_SCRIPT_FETCHING,
  ERR_NO_CONN_SETTING,
  ERR_NO_WS_CONN,
  LOCAL_FILE_EXTENSION,
  OBJECT,
  SERVICE,
  SINGLE_FILE_AUTODOWNLOAD,
  WORKSPACE,
} from "./constants";
import { checkBaseWorkspaceIOB, getWorkspaces } from "./dataService";

export interface GlobalState extends vscode.Memento {
  get(key: "connection" | "workspace"): string;
  get(key: "object"): SiebelObject;
  get(key: "interceptor"): number;
  get(key: "configData"): Connections;
  get(key: "defaultScriptFetching"): Settings["defaultScriptFetching"];
  get(key: "localFileExtension"): Settings["localFileExtension"];
  get(key: "singleFileAutoDownload"): boolean;
}
//create url path from parts
export const joinUrl = (...args: string[]) => args.join("/");

//open the extension settings
export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

//parse the configurations
export const parseSettings = async (globalState: GlobalState) => {
  const {
      connections,
      singleFileAutoDownload,
      localFileExtension,
      defaultScriptFetching,
    } = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ) as unknown as Settings,
    configData: Connections = {};
  try {
    if (Object.keys(connections).length === 0)
      throw new Error(ERR_NO_CONN_SETTING);
    for (const [configString, workspaceString] of Object.entries(connections)) {
      const [connUserPwString, url] = configString.split("@");
      const [connectionName, username, password] = connUserPwString.split("/");
      if (!(url && username && password))
        throw new Error(
          `Missing parameter(s) for the ${connectionName} connection, check the Connections settings!`
        );
      configData[connectionName] = {
        username,
        password,
        url,
        workspaces: workspaceString.split(","),
      };
      if (!workspaceString) {
        const isWorkspaceREST = await checkBaseWorkspaceIOB({
          username,
          password,
          url,
        });
        if (!isWorkspaceREST) {
          delete configData[connectionName];
          vscode.window.showInformationMessage(
            `No workspaces were given for the ${connectionName} connection, and it was not possible to get them from the Siebel REST API, check the Connections setting and/or the Siebel server status!`
          );
          continue;
        }
        configData[connectionName].workspaces = await getWorkspaces({
          username,
          password,
          url,
        });
        if (configData[connectionName].workspaces.length === 0) {
          delete configData[connectionName];
          vscode.window.showInformationMessage(
            `No workspace was found for the ${connectionName} connection created by ${username} having Checkpointed or Edit-In-Progress status!`
          );
        }
      }
    }
    if (Object.keys(configData).length === 0) throw new Error(ERR_NO_WS_CONN);
    const connection = Object.keys(configData)[0],
      workspace = configData[connection].workspaces[0];
    globalState.update(CONFIG_DATA, configData);
    globalState.update(CONNECTION, connection);
    globalState.update(WORKSPACE, workspace);
    globalState.update(OBJECT, SERVICE);
    globalState.update(DEFAULT_SCRIPT_FETCHING, defaultScriptFetching);
    globalState.update(SINGLE_FILE_AUTODOWNLOAD, singleFileAutoDownload);
    globalState.update(LOCAL_FILE_EXTENSION, localFileExtension);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//copy the deprecated settings if they exist to the new setting
export const moveDeprecatedSettings = async () => {
  const {
      "REST EndpointConfigurations": connectionConfigs,
      workspaces,
      connections,
    } = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ) as unknown as Settings & OldSettings,
    workspaceObject: Workspaces = {};
  try {
    if (!connectionConfigs || !(Object.keys(connections).length === 0)) return;
    const connectionsSetting: Settings["connections"] = {};
    for (const workspace of workspaces) {
      const [connectionName, workspaceString] = workspace.split(":");
      workspaceObject[connectionName] = workspaceString
        ? workspaceString.split(",")
        : [];
    }
    for (const config of connectionConfigs) {
      const [connUserPwString] = config.split("@"),
        [connectionName] = connUserPwString?.split("/");
      connectionsSetting[config] = workspaceObject[connectionName]
        ? workspaceObject[connectionName].join(",")
        : "";
    }
    await vscode.workspace
      .getConfiguration()
      .update(
        "siebelScriptAndWebTempEditor.connections",
        connectionsSetting,
        vscode.ConfigurationTarget.Global
      );
  } catch (err: any) {
    vscode.window.showErrorMessage(`An error occured when moving the deprecated parameters to the new settings: ${err.message}, please check and fill the new settings manually!`);
  }
};
