import * as vscode from "vscode";

export class Settings {
  static connections = this.getSetting("connections");
  static defaultConnectionName = this.getSetting("defaultConnectionName");
  static singleFileAutoDownload = this.getSetting("singleFileAutoDownload");
  static localFileExtension = this.getSetting("localFileExtension");
  static defaultScriptFetching = this.getSetting("defaultScriptFetching");
  static maxPageSize = this.getSetting("maxPageSize");

  private static getSetting<T extends keyof AllSettings>(settingName: T) {
    return vscode.workspace
      .getConfiguration("siebelScriptAndWebTempEditor")
      .get(settingName) as AllSettings[T];
  }

  private static async setSetting<T extends keyof AllSettings>(
    settingName: T,
    settingValue: AllSettings[T]
  ) {
    return await vscode.workspace
      .getConfiguration("siebelScriptAndWebTempEditor")
      .update(settingName, settingValue, vscode.ConfigurationTarget.Global);
  }

  private static affectsConfig(
    e: vscode.ConfigurationChangeEvent,
    settingName?: keyof ExtensionSettings
  ) {
    return e.affectsConfiguration(
      `siebelScriptAndWebTempEditor${settingName ? `.${settingName}` : ""}`
    );
  }

  static getConnection(connectionName: string) {
    for (const connection of this.connections) {
      if (connection.name === connectionName) return connection;
    }
    return {} as Config;
  }

  static async setConnections(newConnections: Config[]) {
    await this.setSetting("connections", newConnections);
  }

  static async setDefaultConnectionName(newDefaultConnectionName: string) {
    await this.setSetting("defaultConnectionName", newDefaultConnectionName);
  }

  static configChange(e: vscode.ConfigurationChangeEvent) {
    if (!this.affectsConfig(e)) return false;
    switch (true) {
      case this.affectsConfig(e, "connections"):
        this.connections = this.getSetting("connections");
        return true;
      case this.affectsConfig(e, "defaultConnectionName"):
        this.defaultConnectionName = this.getSetting("defaultConnectionName");
        return false;
      case this.affectsConfig(e, "defaultScriptFetching"):
        this.defaultScriptFetching = this.getSetting("defaultScriptFetching");
        return false;
      case this.affectsConfig(e, "singleFileAutoDownload"):
        this.singleFileAutoDownload = this.getSetting("singleFileAutoDownload");
        return false;
      case this.affectsConfig(e, "localFileExtension"):
        this.localFileExtension = this.getSetting("localFileExtension");
        return false;
      case this.affectsConfig(e, "maxPageSize"):
        this.maxPageSize = this.getSetting("maxPageSize");
        return true;
      default:
        return false;
    }
  }

  static openSettings() {
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "siebelScriptAndWebTempEditor"
    );
  }

  static async moveDeprecatedSettings() {
    try {
      const oldConnections = this.getSetting("REST EndpointConfigurations");
      if (!oldConnections) return;
      const connections = this.connections;
      if (connections.length !== 0) return;
      const workspaces = this.getSetting("workspaces") || [],
        defaultConnection = this.getSetting("defaultConnection"),
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
      await this.setSetting("REST EndpointConfigurations", undefined);
      await this.setSetting("workspaces", undefined);
      await this.setSetting("defaultConnection", undefined);
      await this.setSetting("getWorkspacesFromREST", undefined);
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please create connections manually!`
      );
    }
  }
}
