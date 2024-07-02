import * as vscode from "vscode";
import {
  WORKSPACE,
  WEBTEMP,
  BUSCOMP,
  SERVICE,
  APPLET,
  APPLICATION,
  GET,
  CONNECTION,
  SEARCH,
  TYPE,
  NEW_OR_EDIT_CONNECTION,
  ADD,
  DEFAULT,
  DELETE,
  DELETE_CONNECTION,
  REST_WORKSPACES,
  TEST_CONNECTION,
  TEST_REST_WORKSPACES,
  childlinks,
  uniformresponse,
  IS_NEW_CONNECTION,
  PULL,
  PUSH,
  withCredentials,
  queryParams,
  constantPaths,
  error,
} from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import axios from "axios";
import { WebViews } from "./WebViews";
import { TreeData } from "./TreeData";

export class ExtensionStateManager {
  private static _instance: ExtensionStateManager;
  private readonly workspaceUri = vscode.workspace.workspaceFolders![0].uri;
  private readonly treeData = {
    [SERVICE]: new TreeData(SERVICE),
    [BUSCOMP]: new TreeData(BUSCOMP),
    [APPLET]: new TreeData(APPLET),
    [APPLICATION]: new TreeData(APPLICATION),
    [WEBTEMP]: new TreeData(WEBTEMP),
  } as const;
  private configWebviewPanel: vscode.WebviewPanel | undefined;
  private connection = "";
  private connections: string[] = [];
  private _workspace = "";
  private workspaces: string[] = [];
  private interceptor = 0;
  private type: SiebelObject = SERVICE;

  constructor(context: vscode.ExtensionContext) {
    if (ExtensionStateManager._instance) return ExtensionStateManager._instance;
    ExtensionStateManager._instance = this;
    axios.defaults.method = GET;
    axios.defaults.withCredentials = withCredentials;
    axios.defaults.params = { uniformresponse, childlinks };

    const commands = {
      pullScript: Utils.pushOrPull(PULL),
      pushScript: Utils.pushOrPull(PUSH),
      newConnection: this.configWebview(context, IS_NEW_CONNECTION),
      editConnection: this.configWebview(context),
      openSettings: Settings.openSettings(),
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
      baseURL: Utils.joinUrl(url, WORKSPACE, this.workspace),
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

  private async adjustConnection(
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
    this.workspaces = workspaces;
    if (restWorkspaces) {
      const request: RequestConfig = {
        method: GET,
        url: Utils.joinUrl(url, constantPaths[REST_WORKSPACES]),
        auth: { username, password },
        params: queryParams[REST_WORKSPACES],
      };
      this.workspaces = await Utils.callRestApi(REST_WORKSPACES, request);
    }
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
        if (adjust) return webview.postMessage(await this.adjustConnection());
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async ({ command, data }: DataSourceMessage) => {
          switch (command) {
            case CONNECTION:
              return webview.postMessage(await this.adjustConnection(data));
            case WORKSPACE:
              return (this.workspace = data);
            case TYPE:
              return (this.type = data as SiebelObject);
            case SEARCH:
              return await this.treeData[this.type].search(data);
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = WebViews.dataSourceHTML;
      webview.postMessage(await this.adjustConnection());
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
            case WORKSPACE:
              const { workspaces } = connection;
              switch (action) {
                case ADD:
                  if (workspaces.includes(workspace)) return;
                  workspaces.unshift(workspace);
                  if (workspaces.length === 1)
                    connection.defaultWorkspace = workspace;
                  break;
                case DEFAULT:
                  connection.defaultWorkspace = workspace;
                  break;
                case DELETE:
                  workspaces.splice(workspaces.indexOf(workspace), 1);
                  if (connection.defaultWorkspace === workspace)
                    connection.defaultWorkspace = workspaces[0] ?? "";
                  break;
              }
              await Settings.setConnections(connections);
              return (this.configWebviewPanel!.webview.html =
                WebViews.configHTML(connectionName));
            case TEST_CONNECTION:
            case TEST_REST_WORKSPACES:
              if (!(url && username && password))
                return vscode.window.showErrorMessage(error.missingParameters);
              const request: RequestConfig = {
                method: GET,
                url: Utils.joinUrl(url, constantPaths[command]),
                auth: { username, password },
                params: queryParams[command],
              };
              return await Utils.callRestApi(command, request);
            case NEW_OR_EDIT_CONNECTION:
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
            case DELETE_CONNECTION:
              const answer = await vscode.window.showInformationMessage(
                `Do you want to delete connection ${connectionName}?`,
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
