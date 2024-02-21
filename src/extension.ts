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
  OPEN_SETTINGS,
  TEST_CONNECTION,
  CONFIGURE_CONNECTION,
  ADD,
  DEFAULT,
  DELETE,
  CREATE_OR_UPDATE_CONNECTION,
  NEW_CONNECTION,
  DELETE_CONNECTION,
  ERR_CONN_MISSING_PARAMS,
  DEFAULT_CONNECTION_NAME,
} from "./constants";
import {
  createInterceptor,
  pushOrPullCallback,
  testConnection,
} from "./dataService";
import { createIndexdtsAndJSConfigjson } from "./fileRW";
import {
  //openSettings,
  initState,
  moveDeprecatedSettings,
  GlobalState,
  getSetting,
  openSettings,
  configureConnection,
  setSetting,
} from "./utility";
import { TreeDataProviderObject, TreeDataProviderWebTemp } from "./treeView";
import { configureConnectionsWebview, webViewHTML } from "./webView";

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
  await initState(globalState);

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
  const pullButton = vscode.commands.registerCommand(
    "siebelscriptandwebtempeditor.pullScript",
    pushOrPullCallback(PULL, globalState)
  );
  context.subscriptions.push(pullButton);

  const pushButton = vscode.commands.registerCommand(
    "siebelscriptandwebtempeditor.pushScript",
    pushOrPullCallback(PUSH, globalState)
  );
  context.subscriptions.push(pushButton);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.config",
      () => {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined,
          connectionName = globalState.get(CONNECTION),
          isNewConnection = globalState.get(NEW_CONNECTION);

        if (configWebview) {
          configWebview.webview.html = configureConnectionsWebview(
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
        configWebview.webview.html = configureConnectionsWebview(
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
              connection = connections[connectionName];
            let { workspaces = [], defaultWorkspace = "" } = connection;
            switch (command) {
              case WORKSPACE: {
                switch (action) {
                  case ADD: {
                    if (workspaces.includes(workspace)) break;
                    workspaces.unshift(workspace);
                    if (workspaces.length === 1) defaultWorkspace = workspace;
                    break;
                  }
                  case DEFAULT: {
                    defaultWorkspace = workspace;
                    break;
                  }
                  case DELETE: {
                    workspaces.splice(workspaces.indexOf(workspace), 1);
                    if (connection.defaultWorkspace === workspace)
                      defaultWorkspace = workspaces[0] ?? "";
                  }
                }
                const newConnections = {
                  ...connections,
                  [connectionName]: {
                    ...connection,
                    workspaces,
                    defaultWorkspace,
                  },
                };
                await setSetting(CONNECTIONS, newConnections);
                break;
              }
              case TEST_CONNECTION: {
                const testResult = await testConnection({
                  url,
                  username,
                  password,
                });
                if (testResult)
                  vscode.window.showInformationMessage(
                    "Connection is working!"
                  );
                break;
              }
              case CREATE_OR_UPDATE_CONNECTION: {
                if (!(name && url && username && password))
                  return vscode.window.showErrorMessage(
                    ERR_CONN_MISSING_PARAMS
                  );
                const newConnections = {
                  ...connections,
                  [name]: {
                    url,
                    username,
                    password,
                    restWorkspaces,
                    workspaces,
                    defaultWorkspace,
                  },
                };
                await setSetting(CONNECTIONS, newConnections);
                if (defaultConnection)
                  await setSetting(DEFAULT_CONNECTION_NAME, name);
                globalState.update(NEW_CONNECTION, false);
                initState(globalState);
                break;
              }
              case DELETE_CONNECTION: {
                const newConnections = {
                  ...connections,
                };
                delete newConnections[name];
                await setSetting(CONNECTIONS, newConnections);
                if (globalState.get(CONNECTION) === name)
                  initState(globalState);
                break;
              }
            }
            configWebview!.webview.html = configureConnectionsWebview(
              connectionName,
              globalState.get(NEW_CONNECTION)
            );
          },
          undefined,
          context.subscriptions
        );
      }
    )
  );

  //handle the datasource selection webview and tree views
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: ({ webview }) => {
      //watch changes in the settings
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("siebelScriptAndWebTempEditor")) {
          const prevConnection = globalState.get(CONNECTION),
            prevWorkspace = globalState.get(WORKSPACE);
          await initState(globalState);
          const prevConfigData = getSetting(CONNECTIONS)[prevConnection];
          if (prevConfigData) {
            globalState.update(CONNECTION, prevConnection);
            const workspace = prevConfigData.workspaces.includes(prevWorkspace)
              ? prevWorkspace
              : prevConfigData.workspaces[0];
            globalState.update(WORKSPACE, workspace);
          }
          createInterceptor(globalState);
          webview.html = webViewHTML(globalState);
          if (
            e.affectsConfiguration("siebelScriptAndWebTempEditor.connections")
          )
            clearTreeViews();
        }
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async (message: Message) => {
          const { command, connectionName, workspace, object, searchString } =
            message;
          switch (command) {
            case CONNECTION: {
              //handle connection selection, create the new interceptor and clear the tree views
              globalState.update(CONNECTION, connectionName);
              const firstWorkspace: string =
                getSetting(CONNECTIONS)[connectionName].defaultWorkspace;
              globalState.update(WORKSPACE, firstWorkspace);
              createInterceptor(globalState);
              webview.html = webViewHTML(globalState);
              return clearTreeViews();
            }
            case WORKSPACE: {
              //handle workspace selection, create the new interceptor and clear the tree views
              globalState.update(WORKSPACE, workspace);
              createInterceptor(globalState);
              webview.html = webViewHTML(globalState);
              return clearTreeViews();
            }
            case OBJECT: {
              //handle Siebel object selection
              globalState.update(OBJECT, object);
              webview.html = webViewHTML(globalState);
              return;
            }
            case SEARCH: {
              //get the Siebel objects and create the tree views
              const type = globalState.get(OBJECT);
              return await treeDataProviders[type].debouncedSearch(
                searchString
              );
            }
            case NEW_CONNECTION: {
              globalState.update(NEW_CONNECTION, true);
              return configureConnection();
            }
            case CONFIGURE_CONNECTION: {
              globalState.update(NEW_CONNECTION, false);
              return configureConnection();
            }
            case OPEN_SETTINGS: {
              return openSettings();
            }
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = webViewHTML(globalState);
    },
  };
  const extensionView = vscode.window.registerWebviewViewProvider(
    "extensionView",
    provider
  );
  context.subscriptions.push(extensionView);
}

export function deactivate() {}
