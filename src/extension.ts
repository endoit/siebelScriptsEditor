import * as vscode from "vscode";
import {
  ERR_NO_WS_OPEN,
  PULL,
  PUSH,
  SEARCH,
  CONNECTION,
  WORKSPACE,
  OBJECT,
  CONNECTIONS,
  TEST_CONNECTION,
  ADD,
  DEFAULT,
  DELETE,
  CREATE_OR_UPDATE_CONNECTION,
  DELETE_CONNECTION,
  ERR_CONN_MISSING_PARAMS,
  DEFAULT_CONNECTION_NAME,
  IS_NEW_CONNECTION,
  REST_WORKSPACES,
  ERR_NO_BASE_WS_IOB,
} from "./constants";
import {
  checkBaseWorkspaceIOB,
  pushOrPullCallback,
  testConnection,
} from "./dataService";
import {
  moveDeprecatedSettings,
  getSetting,
  openSettings,
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

  //create the index.d.ts and jsconfig.json if they do not exist
  await createIndexdtsAndJSConfigjson(context);

  //move the deprecated settings into new settings
  await moveDeprecatedSettings();

  //init the first connection and workspace
  await treeViews.setState();

  //buttons to get/update script from/to siebel
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

  const createOrEditConnection =
    (isNewConnection = false) =>
    () => {
      const columnToShowIn = vscode.window.activeTextEditor
          ? vscode.window.activeTextEditor.viewColumn
          : undefined,
        connectionName = treeViews.connection;
      if (!isNewConnection)
        isNewConnection = getSetting(CONNECTIONS).length === 0;

      if (configWebview) {
        configWebview.webview.html = configHTML(
          connectionName,
          isNewConnection
        );
        return configWebview.reveal(columnToShowIn);
      }
      configWebview = vscode.window.createWebviewPanel(
        "configureConnection",
        "Configure Connection",
        columnToShowIn || vscode.ViewColumn.One,
        { enableScripts: true }
      );
      configWebview.webview.html = configHTML(connectionName, isNewConnection);
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
          name,
          url,
          username,
          password,
          restWorkspaces,
          defaultConnection,
        }: MessageConfig) => {
          const connections = getSetting(CONNECTIONS),
            connection = getConnection(name);
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
              configWebview!.webview.html = configHTML(name);
              return;
            case REST_WORKSPACES:
              const restEnabled = await checkBaseWorkspaceIOB({
                url,
                username,
                password,
              });
              if (restEnabled)
                return vscode.window.showInformationMessage(
                  "Getting workspaces from the Siebel REST API is working!"
                );
              return vscode.window.showErrorMessage(ERR_NO_BASE_WS_IOB);
            case TEST_CONNECTION:
              const testResult = await testConnection({
                url,
                username,
                password,
              });
              if (testResult)
                return vscode.window.showInformationMessage(
                  "Connection is working!"
                );
              return;
            case CREATE_OR_UPDATE_CONNECTION:
              if (!(name && url && username && password))
                return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
              if (connections.some((item) => item.name === name)) {
                connection.url = url;
                connection.username = username;
                connection.password = password;
                connection.restWorkspaces = restWorkspaces;
              } else {
                connections.push({
                  name,
                  url,
                  username,
                  password,
                  restWorkspaces,
                  workspaces: [],
                  defaultWorkspace: "",
                });
              }
              await setSetting(CONNECTIONS, connections);
              if (defaultConnection)
                await setSetting(DEFAULT_CONNECTION_NAME, name);
              if (!isNewConnection) return configWebview?.dispose();
              isNewConnection = false;
              configWebview!.webview.html = configHTML(name);
              return;

            case DELETE_CONNECTION:
              const answer = await vscode.window.showInformationMessage(
                `Do you want to delete connection ${name}?`,
                "Yes",
                "No"
              );
              if (answer !== "Yes") return;
              await setSetting(
                CONNECTIONS,
                connections.filter((item) => item.name !== name)
              );
              return configWebview?.dispose();
          }
        },
        undefined,
        context.subscriptions
      );
    };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.newConnection",
      createOrEditConnection(IS_NEW_CONNECTION)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.editConnection",
      createOrEditConnection()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.openSettings",
      openSettings
    )
  );

  //handle the datasource selection webview and tree views
  const dataSourceProvider: vscode.WebviewViewProvider = {
    resolveWebviewView: async ({ webview }) => {
      //watch changes in the settings
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (!e.affectsConfiguration("siebelScriptAndWebTempEditor.connections"))
          return;
        const previousWorkspace = treeViews.workspace;
        treeViews.setState();
        if (treeViews.workspaces.includes(previousWorkspace))
          treeViews.workspace = previousWorkspace;
        webview.postMessage(treeViews.getState());
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async ({ command, name, workspace, object, searchString }: Message) => {
          switch (command) {
            case CONNECTION:
              //handle connection selection, create the new interceptor and clear the tree views
              treeViews.connection = name;
              await treeViews.setState();
              return webview.postMessage(treeViews.getState());
            case WORKSPACE:
              //handle workspace selection, create the new interceptor and clear the tree views
              treeViews.workspace = workspace;
              return;
            case OBJECT:
              //handle Siebel object selection
              treeViews.type = object;
              return;
            case SEARCH:
              return await treeViews.search(searchString);
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = dataSourceHTML;
      webview.postMessage(treeViews.getState());
    },
  };
  const extensionView = vscode.window.registerWebviewViewProvider(
    "extensionView",
    dataSourceProvider
  );
  context.subscriptions.push(extensionView);
}

export function deactivate() {}
