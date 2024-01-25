import * as vscode from "vscode";
import { ERR_NO_CONN_SETTING, ERR_NO_WS_CONN } from "./constants";
import { checkBaseWorkspaceIOB, getWorkspaces } from "./dataService";

//open the extension settings
export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

//parse the configurations
export const parseSettings = async () => {
  const {
      connections,
      defaultConnection,
      singleFileAutoDownload,
      localFileExtension,
      defaultScriptFetching,
    } = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ) as unknown as Settings,
    configData: Connections = {},
    extendedSettings = {
      singleFileAutoDownload,
      localFileExtension,
      defaultScriptFetching,
    };
  let [defaultConnectionName, defaultWorkspace] = defaultConnection.split(":");
  try {
    if (Object.keys(connections).length === 0) {
      throw new Error(ERR_NO_CONN_SETTING);
    }
    for (let [configString, workspaceString] of Object.entries(connections)) {
      const [connUserPwString, url] = configString.split("@");
      const [connectionName, username, password] = connUserPwString.split("/");
      if (!(url && username && password)) {
        throw new Error(
          `Missing parameter(s) for the ${connectionName} connection, check the Connections settings!`
        );
      }
      const workspaces = workspaceString.split(",");
      configData[connectionName] = {
        username,
        password,
        url,
        workspaces,
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
    if (Object.keys(configData).length === 0) {
      throw new Error(ERR_NO_WS_CONN);
    }

    defaultConnectionName = configData.hasOwnProperty(defaultConnectionName)
      ? defaultConnectionName
      : Object.keys(configData)[0];
    defaultWorkspace = configData[
      defaultConnectionName
    ]?.workspaces?.includes?.(defaultWorkspace)
      ? defaultWorkspace
      : configData[defaultConnectionName]?.workspaces?.[0];
    return {
      configData,
      default: { defaultConnectionName, defaultWorkspace },
      extendedSettings,
      isConfigError: false,
    };
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
    return {
      configData: {},
      default: { defaultConnectionName, defaultWorkspace },
      extendedSettings,
      isConfigError: true,
    };
  }
};

//copy the deprecated settings if they exist to the new setting
export const copyConfigurationsToNewSetting = async () => {
  const {
      "REST EndpointConfigurations": connectionConfigs,
      workspaces,
      connections,
    } = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ) as unknown as Settings & OldSettings,
    workspaceObject: Workspaces = {};
  try {
    if (connectionConfigs && Object.keys(connections).length === 0) {
      const connectionsSetting: Record<string, string> = {};
      for (let workspace of workspaces) {
        let [connectionName, workspaceString] = workspace.split(":");
        workspaceObject[connectionName] = workspaceString
          ? workspaceString.split(",")
          : [];
      }
      for (let config of connectionConfigs) {
        let [connUserPwString] = config?.split("@");
        let [connectionName] = connUserPwString?.split("/");
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
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
