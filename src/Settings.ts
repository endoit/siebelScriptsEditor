import * as vscode from "vscode";

export class Settings {
  static connections = this.get("connections");
  static defaultConnectionName = this.get("defaultConnectionName");
  static singleFileAutoDownload = this.get("singleFileAutoDownload");
  static localFileExtension = this.get("localFileExtension");
  static defaultScriptFetching = this.get("defaultScriptFetching");
  static maxPageSize = this.get("maxPageSize");

  private static get<T extends keyof AllSettings>(name: T) {
    return <AllSettings[T]>(
      vscode.workspace
        .getConfiguration("siebelScriptAndWebTempEditor")
        .get(name)
    );
  }

  private static async set<T extends keyof AllSettings>(
    name: T,
    value: AllSettings[T]
  ) {
    await vscode.workspace
      .getConfiguration("siebelScriptAndWebTempEditor")
      .update(name, value, vscode.ConfigurationTarget.Global);
  }

  static getConnection(connectionName: string) {
    for (const connection of this.connections) {
      if (connection.name === connectionName) return connection;
    }
    return {} as Config;
  }

  static async setConnections(newConnections: Config[]) {
    await this.set("connections", newConnections);
  }

  static async setDefaultConnectionName(newDefaultConnectionName: string) {
    await this.set("defaultConnectionName", newDefaultConnectionName);
  }

  static configChange(e: vscode.ConfigurationChangeEvent) {
    if (!e.affectsConfiguration("siebelScriptAndWebTempEditor")) return false;
    for (const name of Object.keys(this)) {
      if (!e.affectsConfiguration(`siebelScriptAndWebTempEditor.${name}`))
        continue;
      (<any>this)[name] = this.get(<keyof ExtensionSettings>name);
      return name === "connections" || name === "maxPageSize";
    }
  }

  static open() {
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "siebelScriptAndWebTempEditor"
    );
  }

  static async moveDeprecated() {
    try {
      const oldConnections = this.get("REST EndpointConfigurations");
      if (!oldConnections) return;
      const connections = this.connections;
      if (connections.length !== 0) return;
      const workspaces = this.get("workspaces") || [],
        defaultConnection = this.get("defaultConnection"),
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
      await this.set("REST EndpointConfigurations", undefined);
      await this.set("workspaces", undefined);
      await this.set("defaultConnection", undefined);
      await this.set("getWorkspacesFromREST", undefined);
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please create connections manually!`
      );
    }
  }
}
