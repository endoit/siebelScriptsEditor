import * as vscode from "vscode";
import {
  ERR_NO_WS_OPEN,
  PULL,
  PUSH,
  SEARCH,
  CONNECTION,
  WORKSPACE,
  CONNECTIONS,
  TEST_CONNECTION,
  ADD,
  DEFAULT,
  DELETE,
  NEW_OR_EDIT_CONNECTION,
  DELETE_CONNECTION,
  ERR_CONN_MISSING_PARAMS,
  DEFAULT_CONNECTION_NAME,
  IS_NEW_CONNECTION,
  REST_WORKSPACES,
  TYPE,
} from "./constants";
import {
  checkBaseWorkspaceIOB,
  pushOrPullCallback,
  testConnection,
} from "./dataService";
import {
  moveDeprecatedSettings,
  getSetting,
  setSetting,
  getConnection,
  createIndexdtsAndJSConfigjson,
} from "./utility";
import { TreeViews } from "./treeView";
import { dataSourceHTML, configHTML } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders?.[0].uri.fsPath)
    return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  let configWebview: vscode.WebviewPanel | undefined = undefined;
  const treeViews = new TreeViews();

  await createIndexdtsAndJSConfigjson(context);
  await moveDeprecatedSettings();

  const configCallback =
    (isNewConnection = false) =>
    () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
      if (!isNewConnection)
        isNewConnection = getSetting(CONNECTIONS).length === 0;

      if (configWebview) {
        configWebview.webview.html = configHTML(
          treeViews.connection,
          isNewConnection
        );
        return configWebview.reveal(columnToShowIn);
      }
      configWebview = vscode.window.createWebviewPanel(
        "configureConnection",
        "Configure Connection",
        columnToShowIn || vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      configWebview.webview.html = configHTML(
        treeViews.connection,
        isNewConnection
      );
      configWebview.onDidDispose(
        () => {
          configWebview = undefined;
        },
        null,
        context.subscriptions
      );
      configWebview.webview.onDidReceiveMessage(
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
          const connections = getSetting(CONNECTIONS),
            connection = getConnection(connectionName);
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
              await setSetting(CONNECTIONS, connections);
              return (configWebview!.webview.html = configHTML(connectionName));
            case REST_WORKSPACES:
              return await checkBaseWorkspaceIOB(url, username, password);
            case TEST_CONNECTION:
              return await testConnection(url, username, password);
            case NEW_OR_EDIT_CONNECTION:
              if (!(connectionName && url && username && password))
                return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
              if (connections.some(({ name }) => name === connectionName)) {
                connection.url = url;
                connection.username = username;
                connection.password = password;
                connection.restWorkspaces = restWorkspaces;
                await setSetting(CONNECTIONS, connections);
                if (defaultConnection)
                  await setSetting(DEFAULT_CONNECTION_NAME, connectionName);
                return configWebview?.dispose();
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
              await setSetting(CONNECTIONS, connections);
              return (configWebview!.webview.html = configHTML(connectionName));
            case DELETE_CONNECTION:
              const answer = await vscode.window.showInformationMessage(
                `Do you want to delete connection ${connectionName}?`,
                "Yes",
                "No"
              );
              if (answer !== "Yes") return;
              await setSetting(
                CONNECTIONS,
                connections.filter(({ name }) => name !== connectionName)
              );
              return configWebview?.dispose();
          }
        },
        undefined,
        context.subscriptions
      );
    };

  vscode.window.registerWebviewViewProvider("extensionView", {
    resolveWebviewView: async ({ webview }) => {
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("siebelScriptAndWebTempEditor.connections"))
          return webview.postMessage(await treeViews.setAndGet());
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async ({ command, data }: DataSourceMessage) => {
          switch (command) {
            case CONNECTION:
              treeViews.connection = data;
              return webview.postMessage(await treeViews.setAndGet());
            case WORKSPACE:
              return (treeViews.workspace = data);
            case TYPE:
              return (treeViews.type = data as SiebelObject);
            case SEARCH:
              return await treeViews.search(data);
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = dataSourceHTML;
      webview.postMessage(await treeViews.setAndGet());
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pullScript",
      pushOrPullCallback(PULL)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pushScript",
      pushOrPullCallback(PUSH)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.newConnection",
      configCallback(IS_NEW_CONNECTION)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.editConnection",
      configCallback()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.openSettings",
      () =>
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "siebelScriptAndWebTempEditor"
        )
    )
  );
}

export function deactivate() {}
