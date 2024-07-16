import * as vscode from "vscode";
import { query, paths, error } from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import axios from "axios";
import { WebViews } from "./WebViews";
import { TreeData } from "./TreeData";

export class ExtensionStateManager {
  private static _instance: ExtensionStateManager;
  private readonly workspaceUri = vscode.workspace.workspaceFolders![0].uri;
  private readonly treeData = {
    service: new TreeData("service"),
    buscomp: new TreeData("buscomp"),
    applet: new TreeData("applet"),
    application: new TreeData("application"),
    webtemp: new TreeData("webtemp"),
  } as const;
  private configWebviewPanel: vscode.WebviewPanel | undefined;
  private connection = "";
  private connections: string[] = [];
  private _workspace = "";
  private workspaces: string[] = [];
  private interceptor = 0;
  private type: SiebelObject = "service";

  constructor(context: vscode.ExtensionContext) {
    if (ExtensionStateManager._instance) return ExtensionStateManager._instance;
    ExtensionStateManager._instance = this;
    axios.defaults.method = "get";
    axios.defaults.withCredentials = true;
    axios.defaults.params = { uniformresponse: "y", childlinks: "None" };

    const commands = {
      pullScript: Utils.pushOrPull("pull"),
      pushScript: Utils.pushOrPull("push"),
      newConnection: this.configWebview(context, true),
      editConnection: this.configWebview(context),
      openSettings: Settings.openSettings,
    };

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: this.dataSourceWebview(context),
    });

    for (const [command, callback] of Object.entries(commands)) {
      vscode.commands.registerCommand(
        `siebelscriptandwebtempeditor.${command}`,
        callback
      );
    }
  }

  private set workspace(newWorkspace: string) {
    this._workspace = newWorkspace;
    const { url, username, password } = Settings.getConnection(this.connection);
    axios.interceptors.request.eject(this.interceptor);
    this.interceptor = axios.interceptors.request.use((config) => ({
      ...config,
      baseURL: Utils.joinUrl(url, "workspace", this.workspace),
      auth: { username, password },
      params: {
        PageSize: Settings.maxPageSize,
        ...config.params,
      },
    }));
    for (const treeDataProvider of Object.values(this.treeData)) {
      treeDataProvider.folder = Utils.joinUri(
        this.workspaceUri,
        this.connection,
        this.workspace
      );
    }
  }

  private get workspace() {
    return this._workspace;
  }

  private async getWorkspacesFromRest(
    url: string,
    username: string,
    password: string
  ) {
    const request: RequestConfig = {
        method: "get",
        url: Utils.joinUrl(url, paths.restWorkspaces),
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
    this.connections = [];
    for (const { name } of Settings.connections) {
      this.connections.push(name);
    }
    if (this.connections.length === 0) {
      vscode.window.showErrorMessage(error.noConnection);
      return {};
    }
    const defaultConnectionName = Settings.defaultConnectionName;
    this.connection = newConnection
      ? newConnection
      : this.connections.includes(this.connection)
      ? this.connection
      : this.connections.includes(defaultConnectionName)
      ? defaultConnectionName
      : this.connections[0];
    const {
      url,
      username,
      password,
      workspaces,
      defaultWorkspace,
      restWorkspaces,
    } = Settings.getConnection(this.connection);
    this.workspaces = restWorkspaces
      ? await this.getWorkspacesFromRest(url, username, password)
      : workspaces;
    this.workspace = this.workspaces?.includes(this.workspace)
      ? this.workspace
      : restWorkspaces || !workspaces.includes(defaultWorkspace)
      ? this.workspaces?.[0] || ""
      : defaultWorkspace;
    return {
      connections: this.connections,
      connection: this.connection,
      workspaces: this.workspaces,
      workspace: this.workspace,
      type: this.type,
    };
  }

  private dataSourceWebview(context: vscode.ExtensionContext) {
    return async ({ webview }: { webview: vscode.Webview }) => {
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        const adjust = Settings.configChange(e);
        if (adjust) return webview.postMessage(await this.setConnection());
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async ({ command, data }: DataSourceMessage) => {
          switch (command) {
            case "connection":
              return webview.postMessage(await this.setConnection(data));
            case "workspace":
              return (this.workspace = data);
            case "type":
              return (this.type = data as SiebelObject);
            case "search":
              return await this.treeData[this.type].search(data);
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = WebViews.dataSourceHTML;
      webview.postMessage(await this.setConnection());
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
      if (!isNewConnection) isNewConnection = this.connections.length === 0;

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
                url: Utils.joinUrl(url, paths[command]),
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
              const answer = await Utils.info(
                `Do you want to delete the ${connectionName} connection?`,
                "Yes",
                "No"
              );
              if (answer !== "Yes") return;
              const newConnections = [];
              for (const connection of connections) {
                if (connection.name !== connectionName)
                  newConnections.push(connection);
              }
              await Settings.setConnections(newConnections);
              return this.configWebviewPanel?.dispose();
          }
        },
        undefined,
        context.subscriptions
      );
    };
  }
}
