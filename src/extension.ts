import { default as axios } from "axios";
import * as vscode from "vscode";
import {
  ERR_CONN_PARAM_PARSE,
  ERR_NO_EDITABLE_WS,
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
  WEBTEMP,
} from "./constants";
import { getSiebelData, getWorkspaces, pushOrPullScript } from "./dataService";
import { copyTypeDefAndJSConfFile } from "./fileRW";
import { selectionChange, TreeDataProvider, TreeItem } from "./treeData";
import { webViewHTML } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders?.[0] === undefined) {
    vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
    return;
  }
  let timeoutId = 0,
    interceptor = 0;
  const emptyDataObj: ScriptObject | WebTempObject = {},
    emptyTreeData = new TreeDataProvider(emptyDataObj),
    state: Record<SiebelObject, TreeDataProvider> = {
      service: emptyTreeData,
      buscomp: emptyTreeData,
      applet: emptyTreeData,
      application: emptyTreeData,
      webtemp: emptyTreeData,
    };

  //create the empty tree views
  for (let objectType of Object.keys(state)) {
    vscode.window.createTreeView(objectType, {
      treeDataProvider: emptyTreeData,
    });
  }

  //clears the tree views
  const clearTreeViews = () => {
    for (let treeDataObj of Object.values(state)) {
      treeDataObj.refresh(emptyDataObj);
    }
  };

  //open the extension settings
  const openSettings = () =>
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "siebelScriptAndWebTempEditor"
    );

  const parseSettings = async () => {
    const {
        "REST EndpointConfigurations": connectionConfigs,
        workspaces,
        getWorkspacesFromREST,
        defaultConnection,
        singleFileAutoDownload,
        localFileExtension,
        defaultScriptFetching,
      } = vscode.workspace.getConfiguration(
        "siebelScriptAndWebTempEditor"
      ) as unknown as BasicSettings & ExtendedSettings,
      configData: Connections = {},
      workspaceObject: Workspaces = {},
      extendedSettings: ExtendedSettings = {
        singleFileAutoDownload,
        localFileExtension,
        defaultScriptFetching,
      };
    let [defaultConnectionName, defaultWorkspace] =
      defaultConnection.split(":");
    try {
      //get workspaces object from the Workspaces setting
      if (!getWorkspacesFromREST) {
        for (let workspace of workspaces) {
          let [connectionName, workspaceString] = workspace.split(":");
          if (!workspaceString) {
            throw new Error(
              `No workspace was found for the ${connectionName} connection, check the Workspaces setting!`
            );
          }
          workspaceObject[connectionName] = workspaceString.split(",");
        }
      }
      //get the connections object
      for (let config of connectionConfigs) {
        let [connUserPwString, url] = config.split("@");
        let [connectionName, username, password] = connUserPwString.split("/");
        if (
          !(
            url &&
            username &&
            password &&
            (workspaceObject.hasOwnProperty(connectionName) ||
              getWorkspacesFromREST)
          )
        ) {
          throw new Error(
            `Missing parameter(s) or workspaces for the ${connectionName} connection, check the REST Endpoint Configurations and Workspaces settings!`
          );
        }
        configData[connectionName] = {
          username,
          password,
          url,
          workspaces: workspaceObject[connectionName],
        };
      }
      //get workspaces from Siebel through REST
      if (getWorkspacesFromREST) {
        for (let [connectionName, connParams] of Object.entries(configData)) {
          configData[connectionName].workspaces = await getWorkspaces(
            connParams
          );
          if (configData[connectionName].workspaces.length === 0) {
            delete configData[connectionName];
          }
        }
        if (Object.keys(configData).length === 0) {
          throw new Error(ERR_NO_EDITABLE_WS);
        }
      }
      //set the default connection
      defaultConnectionName = configData.hasOwnProperty(defaultConnectionName)
        ? defaultConnectionName
        : Object.keys(configData)[0];
      defaultWorkspace = configData[
        defaultConnectionName
      ]?.workspaces?.includes?.(defaultWorkspace)
        ? defaultWorkspace
        : configData[defaultConnectionName]?.workspaces?.[0];
      return {
        configData,
        default: { defaultConnectionName, defaultWorkspace },
        extendedSettings,
        isConfigError: false,
      };
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
      openSettings();
      return {
        configData: {},
        default: { defaultConnectionName, defaultWorkspace },
        extendedSettings,
        isConfigError: true,
      };
    }
  };

  let {
    configData,
    default: { defaultConnectionName, defaultWorkspace },
    extendedSettings,
    isConfigError,
  } = await parseSettings();

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

  //copy the index.d.ts and jsconfig.json if they do not exist
  copyTypeDefAndJSConfFile(context);

  const createInterceptor = () => {
    if (isConfigError) {
      return 0;
    }
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

  //handle the datasource selection
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: (thisWebview: vscode.WebviewView) => {
      //handle changes in the settings
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
          switch (message.command) {
            case SELECT_CONNECTION: {
              //handle connection selection, create the new interceptor and clear the tree views
              selected.connection = message.connectionName!;
              selected.workspace =
                defaultConnectionName === selected.connection
                  ? defaultWorkspace
                  : configData[selected.connection]?.workspaces?.[0];
              interceptor = createInterceptor();
              vscode.window.showInformationMessage(
                `Selected connection: ${selected.connection}`
              );
              thisWebview.webview.html = webViewHTML(configData, selected);
              clearTreeViews();
              return;
            }
            case SELECT_WORKSPACE: {
              //handle workspace selection, create the new interceptor and clear the tree views
              selected.workspace = message.workspace!;
              interceptor = createInterceptor();
              vscode.window.showInformationMessage(
                `Selected workspace: ${message.workspace}`
              );
              thisWebview.webview.html = webViewHTML(configData, selected);
              clearTreeViews();
              return;
            }
            case SELECT_OBJECT: {
              //handle Siebel object selection
              selected.object = message.object!;
              thisWebview.webview.html = webViewHTML(configData, selected);
              return;
            }
            case SEARCH: {
              //get the Siebel objects and create the tree views
              const searchSpec = `Name LIKE "${message.searchString}*"`;
              const folderPath = `${selected.connection}/${selected.workspace}`;
              const objectType = selected.object;
              const debouncedSearch = debounceAsync(() =>
                getSiebelData(searchSpec, folderPath, objectType)
              );
              const dataObj = (await debouncedSearch()) as
                | ScriptObject
                | WebTempObject;
              state[objectType] = new TreeDataProvider(
                dataObj,
                objectType === WEBTEMP
              );

              vscode.window
                .createTreeView(objectType, {
                  treeDataProvider: state[objectType],
                })
                .onDidChangeSelection(async (e) =>
                  selectionChange(
                    e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                    objectType,
                    selected,
                    dataObj,
                    state[objectType],
                    extendedSettings
                  )
                );
              return;
            }
            case SET_DEFAULT: {
              //sets the default connection and workspace in the settings
              const { connectionName, workspace } = message;
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
