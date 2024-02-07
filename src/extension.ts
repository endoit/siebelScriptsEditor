import * as vscode from "vscode";
import {
  APPLET,
  APPLICATION,
  BUSCOMP,
  ERR_NO_WS_OPEN,
  OPEN_CONFIG,
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
} from "./constants";
import { createInterceptor, pushOrPullCallback } from "./dataService";
import { createIndexdtsAndJSConfigjson } from "./fileRW";
import {
  openSettings,
  parseSettings,
  moveDeprecatedSettings,
  GlobalState,
} from "./utility";
import { TreeDataProviderObject, TreeDataProviderWebTemp } from "./treeView";
import { webViewHTML } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceFolder) return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  const globalState = context.globalState as GlobalState;
  globalState.update(WORKSPACE_FOLDER, workspaceFolder);
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

  //parse the configurations and put them into the globalState
  await parseSettings(globalState);

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

  //handle the datasource selection webview and tree views
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: ({ webview }) => {
      //watch changes in the settings
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("siebelScriptAndWebTempEditor")) {
          const prevConnection = globalState.get(CONNECTION),
            prevWorkspace = globalState.get(WORKSPACE);
          await parseSettings(globalState);
          const prevConfigData = globalState.get(CONFIG_DATA)[prevConnection];
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
              const firstWorkspace =
                globalState.get(CONFIG_DATA)[connectionName].workspaces[0];
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
              return await treeDataProviders[type].debouncedSearch(searchString);
            }
            case OPEN_CONFIG:
              return openSettings();
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
