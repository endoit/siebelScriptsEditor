import {
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  SINGLE_FILE_AUTODOWNLOAD,
  LOCAL_FILE_EXTENSION,
  DEFAULT_SCRIPT_FETCHING,
  MAX_PAGE_SIZE,
  DEP_REST_ENDPOINT_CONFIGURATIONS,
  DEP_WORKSPACES,
  DEP_DEFAULT_CONNECTION,
  DEP_GET_WORKSPACES_FROM_REST,
  SECTION,
} from "./constants";
import * as vscode from "vscode";

export class Settings {
  static connections = this.getSetting(CONNECTIONS);
  static defaultConnectionName = this.getSetting(DEFAULT_CONNECTION_NAME);
  static singleFileAutoDownload = this.getSetting(SINGLE_FILE_AUTODOWNLOAD);
  static localFileExtension = this.getSetting(LOCAL_FILE_EXTENSION);
  static defaultScriptFetching = this.getSetting(DEFAULT_SCRIPT_FETCHING);
  static maxPageSize = this.getSetting(MAX_PAGE_SIZE);

  private static getSetting<T extends keyof AllSettings>(settingName: T) {
    return vscode.workspace
      .getConfiguration(SECTION)
      .get(settingName) as AllSettings[T];
  }

  private static async setSetting<T extends keyof AllSettings>(
    settingName: T,
    settingValue: AllSettings[T]
  ) {
    return await vscode.workspace
      .getConfiguration(SECTION)
      .update(settingName, settingValue, vscode.ConfigurationTarget.Global);
  }

  private static affectsConfig(
    e: vscode.ConfigurationChangeEvent,
    settingName?: keyof ExtensionSettings
  ) {
    return e.affectsConfiguration(
      `${SECTION}${settingName ? `.${settingName}` : ""}`
    );
  }

  static getConnection(connectionName: string) {
    for (const connection of this.connections) {
      if (connection.name === connectionName) return connection;
    }
    return {} as Config;
  }

  static async setConnections(newConnections: Config[]) {
    await this.setSetting(CONNECTIONS, newConnections);
  }

  static async setDefaultConnectionName(newDefaultConnectionName: string) {
    await this.setSetting(DEFAULT_CONNECTION_NAME, newDefaultConnectionName);
  }

  static configChange(e: vscode.ConfigurationChangeEvent) {
    if (!this.affectsConfig(e)) return false;
    switch (true) {
      case this.affectsConfig(e, CONNECTIONS):
        this.connections = this.getSetting(CONNECTIONS);
        return true;
      case this.affectsConfig(e, DEFAULT_CONNECTION_NAME):
        this.defaultConnectionName = this.getSetting(DEFAULT_CONNECTION_NAME);
        return false;
      case this.affectsConfig(e, DEFAULT_SCRIPT_FETCHING):
        this.defaultScriptFetching = this.getSetting(DEFAULT_SCRIPT_FETCHING);
        return false;
      case this.affectsConfig(e, SINGLE_FILE_AUTODOWNLOAD):
        this.singleFileAutoDownload = this.getSetting(SINGLE_FILE_AUTODOWNLOAD);
        return false;
      case this.affectsConfig(e, LOCAL_FILE_EXTENSION):
        this.localFileExtension = this.getSetting(LOCAL_FILE_EXTENSION);
        return false;
      case this.affectsConfig(e, MAX_PAGE_SIZE):
        this.maxPageSize = this.getSetting(MAX_PAGE_SIZE);
        return true;
      default:
        return false;
    }
  }

  static openSettings() {
    vscode.commands.executeCommand("workbench.action.openSettings", SECTION);
  }

  static async moveDeprecatedSettings() {
    try {
      const oldConnections = this.getSetting(DEP_REST_ENDPOINT_CONFIGURATIONS);
      if (!oldConnections) return;
      const connections = this.connections;
      if (connections.length !== 0) return;
      const workspaces = this.getSetting(DEP_WORKSPACES) || [],
        defaultConnection = this.getSetting(DEP_DEFAULT_CONNECTION),
        newConnections: Config[] = [],
        workspaceObject: Record<string, string[]> = {};
      let isDefault = false;
      const [defaultConnectionName = "", defaultWorkspace = ""] =
        defaultConnection?.split(":") || [];
      for (const workspace of workspaces) {
        const [name, workspaceString] = workspace.split(":");
        workspaceObject[name] = workspaceString
          ? workspaceString.split(",")
          : [];
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
      await this.setConnections(newConnections);
      await this.setDefaultConnectionName(
        isDefault ? defaultConnectionName : newConnections[0].name
      );
      await this.setSetting(DEP_REST_ENDPOINT_CONFIGURATIONS, undefined);
      await this.setSetting(DEP_WORKSPACES, undefined);
      await this.setSetting(DEP_DEFAULT_CONNECTION, undefined);
      await this.setSetting(DEP_GET_WORKSPACES_FROM_REST, undefined);
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please create connections manually!`
      );
    }
  }
}
