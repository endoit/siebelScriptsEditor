import { default as axios } from "axios";
import * as vscode from "vscode";
import {
  ERR_CONN_PARAM_PARSE,
  ERR_NO_WS_OPEN,
  OPEN_CONFIG,
  PULL,
  PUSH,
  SEARCH,
  SELECT_CONNECTION,
  SELECT_OBJECT,
  SELECT_WORKSPACE,
  SERVICE,
  SET_DEFAULT,
  TREE_OBJECT,
  TREE_WEBTEMP,
  WEBTEMP,
} from "./constants";
import { getSiebelData, pushOrPullScript } from "./dataService";
import { createIndexdtsAndJSConfigjson } from "./fileRW";
import { openSettings, parseSettings, moveDeprecatedSettings } from "./utility";
import { selectionChange, TreeDataProvider, TreeItem } from "./treeData";
import { webViewHTML } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders?.[0] === undefined)
    return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  let timeoutId = 0,
    interceptor = 0;
  const emptyTreeDataObject = new TreeDataProvider({}, TREE_OBJECT),
    emptyTreeDataWebtemp = new TreeDataProvider({}, TREE_WEBTEMP),
    state: Record<SiebelObject, TreeDataProvider> = {
      service: emptyTreeDataObject,
      buscomp: emptyTreeDataObject,
      applet: emptyTreeDataObject,
      application: emptyTreeDataObject,
      webtemp: emptyTreeDataWebtemp,
    };

  //creates the index.d.ts and jsconfig.json if they do not exist
  createIndexdtsAndJSConfigjson(context);

  //moves the deprecated settings into new settings
  await moveDeprecatedSettings();

  //create the empty tree views
  for (const [objectType, treeDataProvider] of Object.entries(state)) {
    vscode.window.createTreeView(objectType, {
      treeDataProvider,
      showCollapseAll: objectType !== WEBTEMP,
    });
  }

  //clear the tree views
  const clearTreeViews = () => {
    for (const treeDataProvider of Object.values(state)) {
      treeDataProvider.clear();
    }
  };

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

  //parse the configurations
  let {
    configData,
    default: { defaultConnectionName, defaultWorkspace },
    extendedSettings,
    isConfigError,
  } = await parseSettings();

  //holds information about the currently selected connection and objects
  const selected: Selected = {
    connection: defaultConnectionName,
    workspace: defaultWorkspace,
    object: SERVICE,
    service: { name: "", childName: "" },
    buscomp: { name: "", childName: "" },
    applet: { name: "", childName: "" },
    application: { name: "", childName: "" },
    webtemp: { name: "" },
  };

  //axios interceptor handling function
  const createInterceptor = () => {
    if (isConfigError) return 0;
    const { url, username, password } = configData[selected.connection];
    axios.interceptors.request.eject(interceptor);
    return axios.interceptors.request.use((config) => ({
      ...config,
      baseURL: `${url}/workspace/${selected.workspace}`,
      auth: { username, password },
    }));
  };

  //create the interceptor for the default/first connection
  interceptor = createInterceptor();

  //callback for the push/pull buttons
  const pushPullCallback = (action: ButtonAction) => async () => {
    if (isConfigError) {
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
    if (answer === "Yes") {
      pushOrPullScript(action, configData);
    }
  };

  //buttons to get/update script from/to siebel
  const pullButton = vscode.commands.registerCommand(
    "siebelscriptandwebtempeditor.pullScript",
    pushPullCallback(PULL)
  );
  context.subscriptions.push(pullButton);

  const pushButton = vscode.commands.registerCommand(
    "siebelscriptandwebtempeditor.pushScript",
    pushPullCallback(PUSH)
  );
  context.subscriptions.push(pushButton);

  //handle the datasource selection webview and tree views
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: (thisWebview: vscode.WebviewView) => {
      //watch changes in the settings
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (
          e.affectsConfiguration("siebelScriptAndWebTempEditor") &&
          !e.affectsConfiguration(
            "siebelScriptAndWebTempEditor.defaultConnection"
          )
        ) {
          ({
            configData,
            default: { defaultConnectionName, defaultWorkspace },
            extendedSettings,
            isConfigError,
          } = await parseSettings());
          selected.connection = configData.hasOwnProperty(selected.connection)
            ? selected.connection
            : defaultConnectionName;
          selected.workspace = configData[
            selected.connection
          ]?.workspaces.includes(selected.workspace)
            ? selected.workspace
            : defaultWorkspace;
          interceptor = createInterceptor();
          thisWebview.webview.html = webViewHTML(
            configData,
            selected,
            isConfigError
          );
        }
      });
      thisWebview.webview.options = { enableScripts: true };
      thisWebview.webview.onDidReceiveMessage(
        async (message: Message) => {
          const { command, connectionName, workspace, object, searchString } =
            message;
          switch (command) {
            case SELECT_CONNECTION: {
              //handle connection selection, create the new interceptor and clear the tree views
              selected.connection = connectionName;
              selected.workspace =
                defaultConnectionName === connectionName
                  ? defaultWorkspace
                  : configData[connectionName]?.workspaces?.[0];
              interceptor = createInterceptor();
              thisWebview.webview.html = webViewHTML(configData, selected);
              clearTreeViews();
              return;
            }
            case SELECT_WORKSPACE: {
              //handle workspace selection, create the new interceptor and clear the tree views
              selected.workspace = workspace;
              interceptor = createInterceptor();
              thisWebview.webview.html = webViewHTML(configData, selected);
              clearTreeViews();
              return;
            }
            case SELECT_OBJECT: {
              //handle Siebel object selection
              selected.object = object;
              thisWebview.webview.html = webViewHTML(configData, selected);
              return;
            }
            case SEARCH: {
              //get the Siebel objects and create the tree views
              const folderPath = `${selected.connection}/${selected.workspace}`;
              const objectType = selected.object;
              const debouncedSearch: () => Promise<
                ScriptObject | WebTempObject
              > = debounceAsync(() =>
                getSiebelData(searchString, folderPath, objectType)
              );
              const dataObject = await debouncedSearch();
              state[objectType] =
                objectType !== WEBTEMP
                  ? new TreeDataProvider(
                      dataObject as ScriptObject,
                      TREE_OBJECT
                    )
                  : new TreeDataProvider(
                      dataObject as WebTempObject,
                      TREE_WEBTEMP
                    );
              vscode.window
                .createTreeView(objectType, {
                  treeDataProvider: state[objectType],
                })
                .onDidChangeSelection(async (e) =>
                  selectionChange(
                    e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                    selected,
                    dataObject,
                    state[objectType],
                    extendedSettings
                  )
                );
              return;
            }
            case SET_DEFAULT: {
              //sets the default connection and workspace in the settings
              const answer = await vscode.window.showInformationMessage(
                `Do you want to set the default connection to ${connectionName} and the default workspace to ${workspace}?`,
                "Yes",
                "No"
              );
              if (answer === "Yes") {
                await vscode.workspace
                  .getConfiguration()
                  .update(
                    "siebelScriptAndWebTempEditor.defaultConnection",
                    `${connectionName}:${workspace}`,
                    vscode.ConfigurationTarget.Global
                  );
              }
              return;
            }
            case OPEN_CONFIG: {
              //opens the Settings for the extension
              openSettings();
              return;
            }
          }
        },
        undefined,
        context.subscriptions
      );
      thisWebview.webview.html = webViewHTML(
        configData,
        selected,
        isConfigError
      );
    },
  };
  const extensionView = vscode.window.registerWebviewViewProvider(
    "extensionView",
    provider
  );
  context.subscriptions.push(extensionView);
}

export function deactivate() {}
