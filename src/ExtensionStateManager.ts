import * as vscode from "vscode";
import { query, paths, error } from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import axios from "axios";
import { WebViews } from "./WebViews";
import { TreeData } from "./TreeData";

export class ExtensionStateManager {
  private static _instance: ExtensionStateManager;
  private readonly treeData = {
    service: new TreeData("service"),
    buscomp: new TreeData("buscomp"),
    applet: new TreeData("applet"),
    application: new TreeData("application"),
    webtemp: new TreeData("webtemp"),
  } as const;
  private configWebviewPanel: vscode.WebviewPanel | undefined;
  private connection = "";
  private workspace = "";
  private type: SiebelObject = "service";

  constructor(context: vscode.ExtensionContext) {
    if (ExtensionStateManager._instance) return ExtensionStateManager._instance;
    ExtensionStateManager._instance = this;
    axios.defaults.method = "get";
    axios.defaults.withCredentials = true;

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: this.dataSourceWebview(context),
    });

    const commands = {
      pull: Utils.pushOrPull("pull"),
      push: Utils.pushOrPull("push"),
      newConnection: this.configWebview(context, true),
      editConnection: this.configWebview(context),
      openSettings: Settings.open,
    };

    for (const [command, callback] of Object.entries(commands)) {
      vscode.commands.registerCommand(
        `siebelscriptandwebtempeditor.${command}`,
        callback
      );
    }
  }

  private setType(newType: string) {
    this.type = <SiebelObject>newType;
  }

  private setWorkspace(newWorkspace: string) {
    this.workspace = newWorkspace;
    const { url, username, password } = Settings.getConnection(this.connection);
    axios.defaults.baseURL = [url, "workspace", this.workspace].join("/");
    axios.defaults.auth = { username, password };
    axios.defaults.params = {
      uniformresponse: "y",
      childlinks: "None",
      PageSize: Settings.maxPageSize,
    };
    for (const treeDataProvider of Object.values(this.treeData)) {
      treeDataProvider.folder = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        this.connection,
        this.workspace
      );
    }
  }

  private async getWorkspacesFromRest(
    url: string,
    username: string,
    password: string
  ) {
    const request: RequestConfig = {
        method: "get",
        url: [url, paths.restWorkspaces].join("/"),
        auth: { username, password },
        params: query.restWorkspaces,
      },
      data = await Utils.callRestApi("restWorkspaces", request),
      workspaces = [];
    for (const { Name } of data) {
      workspaces.push(Name);
    }
    return workspaces;
  }

  private async setConnection(
    newConnection?: string
  ): Promise<ExtensionStateMessage> {
    const connections = [];
    for (const { name } of Settings.connections) {
      connections.push(name);
    }
    if (connections.length === 0) {
      vscode.window.showErrorMessage(error.noConnection);
      return {};
    }
    const defaultConnectionName = Settings.defaultConnectionName;
    this.connection = newConnection
      ? newConnection
      : connections.includes(this.connection)
      ? this.connection
      : connections.includes(defaultConnectionName)
      ? defaultConnectionName
      : connections[0];
    const {
      url,
      username,
      password,
      workspaces,
      defaultWorkspace,
      restWorkspaces,
    } = Settings.getConnection(this.connection);
    const newWorkspaces = restWorkspaces
        ? await this.getWorkspacesFromRest(url, username, password)
        : workspaces,
      newWorkspace = newWorkspaces.includes(this.workspace)
        ? this.workspace
        : restWorkspaces || !newWorkspaces.includes(defaultWorkspace)
        ? newWorkspaces?.[0] || ""
        : defaultWorkspace;
    this.setWorkspace(newWorkspace);
    return {
      connections,
      connection: this.connection,
      workspaces: newWorkspaces,
      workspace: this.workspace,
      type: this.type,
    };
  }

  private dataSourceWebview(context: vscode.ExtensionContext) {
    return async ({ webview }: { webview: vscode.Webview }) => {
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!Settings.configChange(e)) return;
        await webview.postMessage(await this.setConnection());
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async ({ command, data }: DataSourceMessage) => {
          switch (command) {
            case "connection":
              return await webview.postMessage(await this.setConnection(data));
            case "workspace":
              return this.setWorkspace(data);
            case "type":
              return this.setType(data);
            case "search":
              return await this.treeData[this.type].search(data);
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = WebViews.dataSourceHTML;
      await webview.postMessage(await this.setConnection());
    };
  }

  private configWebview(
    context: vscode.ExtensionContext,
    isNewConnection = false
  ) {
    return async () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
      if (!isNewConnection) isNewConnection = Settings.connections.length === 0;
      if (this.configWebviewPanel) {
        this.configWebviewPanel.webview.html = WebViews.configHTML(
          this.connection,
          isNewConnection
        );
        return this.configWebviewPanel.reveal(columnToShowIn);
      }
      this.configWebviewPanel = vscode.window.createWebviewPanel(
        "configureConnection",
        "Configure Connection",
        columnToShowIn || vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.configWebviewPanel.webview.html = WebViews.configHTML(
        this.connection,
        isNewConnection
      );
      this.configWebviewPanel.onDidDispose(
        () => (this.configWebviewPanel = undefined),
        null,
        context.subscriptions
      );
      this.configWebviewPanel.webview.onDidReceiveMessage(
        async ({
          command,
          action,
          workspace,
          connectionName,
          url,
          username,
          password,
          restWorkspaces,
          defaultConnection,
        }: ConfigMessage) => {
          const connections = Settings.connections,
            connection = Settings.getConnection(connectionName);
          switch (command) {
            case "workspace":
              const { workspaces } = connection;
              switch (action) {
                case "add":
                  if (workspaces.includes(workspace)) return;
                  workspaces.unshift(workspace);
                  if (workspaces.length !== 1) break;
                case "default":
                  connection.defaultWorkspace = workspace;
                  break;
                case "delete":
                  workspaces.splice(workspaces.indexOf(workspace), 1);
                  if (connection.defaultWorkspace === workspace)
                    connection.defaultWorkspace = workspaces[0] ?? "";
                  break;
              }
              await Settings.setConnections(connections);
              return (this.configWebviewPanel!.webview.html =
                WebViews.configHTML(connectionName));
            case "testConnection":
            case "testRestWorkspaces":
              if (!(url && username && password))
                return vscode.window.showErrorMessage(error.missingParameters);
              const request: RequestConfig = {
                method: "get",
                url: [url, paths[command]].join("/"),
                auth: { username, password },
                params: query[command],
              };
              return await Utils.callRestApi(command, request);
            case "newOrEditConnection":
              if (!(connectionName && url && username && password))
                return vscode.window.showErrorMessage(error.missingParameters);
              if (connection.name) {
                connection.url = url;
                connection.username = username;
                connection.password = password;
                connection.restWorkspaces = restWorkspaces;
                await Settings.setConnections(connections);
                if (defaultConnection)
                  await Settings.setDefaultConnectionName(connectionName);
                return this.configWebviewPanel?.dispose();
              }
              connections.unshift({
                name: connectionName,
                url,
                username,
                password,
                restWorkspaces,
                workspaces: [],
                defaultWorkspace: "",
              });
              await Settings.setConnections(connections);
              return (this.configWebviewPanel!.webview.html =
                WebViews.configHTML(connectionName));
            case "deleteConnection":
              const answer = await vscode.window.showInformationMessage(
                `Do you want to delete the ${connectionName} connection?`,
                "Yes",
                "No"
              );
              if (answer !== "Yes") return;
              let index = 0;
              for (index; index < connections.length; index++) {
                if (connections[index].name === connectionName) break;
              }
              connections.splice(index, 1);
              await Settings.setConnections(connections);
              return this.configWebviewPanel?.dispose();
          }
        },
        undefined,
        context.subscriptions
      );
    };
  }
}
