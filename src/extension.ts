import * as vscode from "vscode";
import {
  APPLET,
  APPLICATION,
  BUSCOMP,
  ERR_NO_WS_OPEN,
  PULL,
  PUSH,
  SEARCH,
  SERVICE,
  WEBTEMP,
  CONNECTION,
  WORKSPACE,
  CONFIG_DATA,
  OBJECT,
  WORKSPACE_FOLDER,
  CONNECTIONS,
  TEST_CONNECTION,
  ADD,
  DEFAULT,
  DELETE,
  CREATE_OR_UPDATE_CONNECTION,
  DELETE_CONNECTION,
  ERR_CONN_MISSING_PARAMS,
  DEFAULT_CONNECTION_NAME,
  NEW_CONNECTION,
  IS_NEW_CONNECTION,
  REST_WORKSPACES,
} from "./constants";
import {
  checkBaseWorkspaceIOB,
  createInterceptor,
  getWorkspaces,
  pushOrPullCallback,
  testConnection,
} from "./dataService";
import { createIndexdtsAndJSConfigjson } from "./fileRW";
import {
  refreshState,
  moveDeprecatedSettings,
  GlobalState,
  getSetting,
  openSettings,
  setSetting,
  getConnection,
} from "./utility";
import { TreeDataProviderObject, TreeDataProviderWebTemp } from "./treeView";
import { connectionWebview, dataSourceWebview } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceFolder) return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  const globalState = context.globalState as GlobalState;
  globalState.update(WORKSPACE_FOLDER, workspaceFolder);
  let configWebview: vscode.WebviewPanel | undefined = undefined;
  const treeDataProviders: Record<
    SiebelObject,
    TreeDataProviderObject | TreeDataProviderWebTemp
  > = {
    service: new TreeDataProviderObject(SERVICE, globalState),
    buscomp: new TreeDataProviderObject(BUSCOMP, globalState),
    applet: new TreeDataProviderObject(APPLET, globalState),
    application: new TreeDataProviderObject(APPLICATION, globalState),
    webtemp: new TreeDataProviderWebTemp(WEBTEMP, globalState),
  };

  //create the index.d.ts and jsconfig.json if they do not exist
  await createIndexdtsAndJSConfigjson(context);

  //move the deprecated settings into new settings
  await moveDeprecatedSettings();

  //get the configuration data into the globalState
  await refreshState(globalState);

  //create the tree views with the selection change callback
  for (const [type, treeDataProvider] of Object.entries(treeDataProviders)) {
    vscode.window
      .createTreeView(type, {
        treeDataProvider,
        showCollapseAll: type !== WEBTEMP,
      })
      .onDidChangeSelection(async (e) =>
        treeDataProvider.selectionChange(e as any)
      );
  }

  //clear the tree views and set the connection and workspace name
  const clearTreeViews = () => {
    for (const treeDataProvider of Object.values(treeDataProviders)) {
      treeDataProvider.clear();
    }
  };

  //create the interceptor for the first connection
  createInterceptor(globalState);

  //buttons to get/update script from/to siebel
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pullScript",
      pushOrPullCallback(PULL, globalState)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pushScript",
      pushOrPullCallback(PUSH, globalState)
    )
  );

  const createOrEditConnection =
    (isNewConnection = false) =>
    () => {
      const columnToShowIn = vscode.window.activeTextEditor
          ? vscode.window.activeTextEditor.viewColumn
          : undefined,
        connectionName = globalState.get(CONNECTION);

      if (configWebview) {
        configWebview.webview.html = connectionWebview(
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
      configWebview.webview.html = connectionWebview(
        connectionName,
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
        async (message: MessageConfig) => {
          const {
              command,
              action,
              workspace,
              name,
              url,
              username,
              password,
              restWorkspaces,
              defaultConnection,
            } = message,
            connections = getSetting(CONNECTIONS),
            connection = getConnection(name);
          switch (command) {
            case WORKSPACE: {
              const { workspaces } = connection;
              switch (action) {
                case ADD: {
                  if (workspaces.includes(workspace)) break;
                  workspaces.unshift(workspace);
                  if (workspaces.length === 1)
                    connection.defaultWorkspace = workspace;
                  break;
                }
                case DEFAULT: {
                  connection.defaultWorkspace = workspace;
                  break;
                }
                case DELETE: {
                  workspaces.splice(workspaces.indexOf(workspace), 1);
                  if (connection.defaultWorkspace === workspace)
                    connection.defaultWorkspace = workspaces[0] ?? "";
                  break;
                }
              }
              await setSetting(CONNECTIONS, connections);
              configWebview!.webview.html = connectionWebview(name);
              return;
            }
            case REST_WORKSPACES: {
              const restEnabled = await checkBaseWorkspaceIOB({
                url,
                username,
                password,
              });
              if (restEnabled)
                return vscode.window.showInformationMessage(
                  "Getting workspaces from the Siebel REST API is working!"
                );
              return vscode.window.showErrorMessage(
                "Error in getting workspaces from the Siebel REST API, Base Workspace integration object is missing!"
              );
            }
            case TEST_CONNECTION: {
              const testResult = await testConnection({
                url,
                username,
                password,
              });
              if (testResult)
                return vscode.window.showInformationMessage(
                  "Connection is working!"
                );
            }
            case CREATE_OR_UPDATE_CONNECTION: {
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
              configWebview!.webview.html = connectionWebview(name);
              return;
            }
            case DELETE_CONNECTION: {
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
    resolveWebviewView: ({ webview }) => {
      //watch changes in the settings
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("siebelScriptAndWebTempEditor")) {
          const prevName = globalState.get(CONNECTION),
            prevWorkspace = globalState.get(WORKSPACE);
          await refreshState(globalState);
          const { name, workspaces } = getConnection(prevName);
          if (name) {
            globalState.update(CONNECTION, prevName);
            const workspace = workspaces.includes(prevWorkspace)
              ? prevWorkspace
              : workspaces[0];
            globalState.update(WORKSPACE, workspace);
          }
          createInterceptor(globalState);
          webview.html = dataSourceWebview(globalState);
          if (
            e.affectsConfiguration("siebelScriptAndWebTempEditor.connections")
          )
            clearTreeViews();
        }
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async (message: Message) => {
          const { command, name, workspace, object, searchString } = message;
          switch (command) {
            case CONNECTION: {
              //handle connection selection, create the new interceptor and clear the tree views
              globalState.update(CONNECTION, name);
              const {
                url,
                username,
                password,
                defaultWorkspace,
                restWorkspaces,
              } = getConnection(name);
              globalState.update(WORKSPACE, defaultWorkspace);
              if (restWorkspaces) {
                const workspaces = await getWorkspaces({url, username, password});
                globalState.update(REST_WORKSPACES, workspaces);
              }
              createInterceptor(globalState);
              webview.html = dataSourceWebview(globalState);
              return clearTreeViews();
            }
            case WORKSPACE: {
              //handle workspace selection, create the new interceptor and clear the tree views
              globalState.update(WORKSPACE, workspace);
              createInterceptor(globalState);
              webview.html = dataSourceWebview(globalState);
              return clearTreeViews();
            }
            case OBJECT: {
              //handle Siebel object selection
              globalState.update(OBJECT, object);
              webview.html = dataSourceWebview(globalState);
              return;
            }
            case SEARCH: {
              //get the Siebel objects and create the tree views
              const type = globalState.get(OBJECT);
              return await treeDataProviders[type].debouncedSearch(
                searchString
              );
            }
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = dataSourceWebview(globalState);
    },
  };
  const extensionView = vscode.window.registerWebviewViewProvider(
    "extensionView",
    dataSourceProvider
  );
  context.subscriptions.push(extensionView);
}

export function deactivate() {}
