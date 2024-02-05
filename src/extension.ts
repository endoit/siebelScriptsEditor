import * as vscode from "vscode";
import {
  APPLET,
  APPLICATION,
  BUSCOMP,
  ERR_CONN_PARAM_PARSE,
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
} from "./constants";
import { createInterceptor, pushOrPullScript } from "./dataService";
import { createIndexdtsAndJSConfigjson } from "./fileRW";
import {
  openSettings,
  parseSettings,
  moveDeprecatedSettings,
  GlobalState,
} from "./utility";
import {
  selectionChange,
  TreeDataProviderObject,
  TreeDataProviderWebtemp,
  TreeItem,
} from "./treeData";
import { webViewHTML } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders?.[0] === undefined)
    return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  let timeoutId = 0;
  const globalState = context.globalState as GlobalState,
    treeViewState: Record<
      SiebelObject,
      TreeDataProviderObject | TreeDataProviderWebtemp
    > = {
      service: new TreeDataProviderObject(globalState, SERVICE),
      buscomp: new TreeDataProviderObject(globalState, BUSCOMP),
      applet: new TreeDataProviderObject(globalState, APPLET),
      application: new TreeDataProviderObject(globalState, APPLICATION),
      webtemp: new TreeDataProviderWebtemp(globalState, WEBTEMP),
    };

  //create the index.d.ts and jsconfig.json if they do not exist
  createIndexdtsAndJSConfigjson(context);

  //move the deprecated settings into new settings
  await moveDeprecatedSettings();

  //parse the configurations and put them into the globalState
  await parseSettings(globalState);

  //create the tree views with the selection change callback
  for (const [objectType, treeDataProvider] of Object.entries(treeViewState)) {
    vscode.window
      .createTreeView(objectType, {
        treeDataProvider,
        showCollapseAll: objectType !== WEBTEMP,
      })
      .onDidChangeSelection(async (e) =>
        selectionChange(
          e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
          treeDataProvider,
          globalState
        )
      );
  }

  //clear the tree views and set the connection and workspace name
  const clearTreeViews = () => {
    for (const treeDataProvider of Object.values(treeViewState)) {
      treeDataProvider.clear();
    }
  };

  //create the interceptor for the default/first connection
  createInterceptor(globalState);

  //callback for the push/pull buttons
  const pushPullCallback = (action: ButtonAction, globalState: GlobalState) => async () => {
    if (!globalState.get(CONNECTION)) {
      vscode.window.showErrorMessage(ERR_CONN_PARAM_PARSE);
      openSettings();
      return;
    }
    const answer = await vscode.window.showInformationMessage(
      `Do you want to overwrite ${
        action === PULL
          ? "the current script/web template definition from"
          : "this script/web template definition in"
      } Siebel?`,
      "Yes",
      "No"
    );
    if (answer !== "Yes") return;
    pushOrPullScript(action, globalState);
  };

  //buttons to get/update script from/to siebel
  const pullButton = vscode.commands.registerCommand(
    "siebelscriptandwebtempeditor.pullScript",
    pushPullCallback(PULL, globalState)
  );
  context.subscriptions.push(pullButton);

  const pushButton = vscode.commands.registerCommand(
    "siebelscriptandwebtempeditor.pushScript",
    pushPullCallback(PUSH, globalState)
  );
  context.subscriptions.push(pushButton);

  //debounce the search input
  const debounceAsync =
    <T, Callback extends (...args: any[]) => Promise<T>>(
      callback: Callback
    ): ((...args: Parameters<Callback>) => Promise<T>) =>
    (...args: any[]) => {
      clearTimeout(timeoutId);
      return new Promise<T>((resolve) => {
        const timeoutPromise = new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, 300);
        });
        timeoutPromise.then(async () => {
          resolve(await callback(...args));
        });
      });
    };

  //handle the datasource selection webview and tree views
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: ({ webview } /*thisWebview: vscode.WebviewView*/) => {
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
              clearTreeViews();
              return;
            }
            case WORKSPACE: {
              //handle workspace selection, create the new interceptor and clear the tree views
              globalState.update(WORKSPACE, workspace);
              createInterceptor(globalState);
              webview.html = webViewHTML(globalState);
              clearTreeViews();
              return;
            }
            case OBJECT: {
              //handle Siebel object selection
              globalState.update(OBJECT, object);
              webview.html = webViewHTML(globalState);
              return;
            }
            case SEARCH: {
              //get the Siebel objects and create the tree views
              const objectType = globalState.get(OBJECT),
                debouncedSearch = debounceAsync(() =>
                  treeViewState[objectType].createTreeViewData(searchString)
                );
              await debouncedSearch();
              return;
            }
            case OPEN_CONFIG: {
              //opens the Settings for the extension
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
