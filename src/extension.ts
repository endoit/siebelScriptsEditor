import { default as axios } from "axios";
import * as vscode from "vscode";
import {
  APPLET,
  APPLET_LONG,
  APPLICATION,
  APPLICATION_LONG,
  BUSCOMP,
  BUSCOMP_LONG,
  ERROR,
  ERR_CONN_ERROR,
  ERR_CONN_PARAM_FORMAT,
  ERR_CONN_PARAM_PARSE,
  ERR_NO_CONFIG,
  ERR_NO_EDITABLE_WS,
  ERR_NO_WS_OPEN,
  GET,
  IS_WEBTEMPLATE,
  NO_REST_CONFIG,
  OPEN_CONFIG,
  PULL,
  PUSH,
  RELOAD,
  RELOAD_ENABLED,
  SEARCH,
  SELECT_CONNECTION,
  SELECT_OBJECT,
  SELECT_WORKSPACE,
  SERVICE,
  SERVICE_LONG,
  SET_DEFAULT,
  TEST_REST,
  WEBTEMP,
  WEBTEMP_LONG,
} from "./constants";
import {
  callRESTAPIInstance,
  getSiebelData,
  getWorkspaces,
  pushOrPullScript,
} from "./dataService";
import { copyTypeDefFile } from "./fileRW";
import { selectionChange, TreeDataProvider, TreeItem } from "./treeData";
import { webViewHTML } from "./webView";

export async function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.workspaceFolders?.[0] === undefined) {
    vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
    return;
  }
  let isConfigError = false;
  let url: string;
  let username: string;
  let password: string;
  let treeDataBS: TreeDataProvider;
  let treeDataBC: TreeDataProvider;
  let treeDataApplet: TreeDataProvider;
  let treeDataApplication: TreeDataProvider;
  let treeDataWebTemp: TreeDataProvider;
  let timeoutId = 0;

  const connectionConfigs: string[] = vscode.workspace.getConfiguration(
    "siebelScriptAndWebTempEditor"
  )["REST EndpointConfigurations"];

  const isWorkspaceREST: boolean = vscode.workspace.getConfiguration(
    "siebelScriptAndWebTempEditor"
  )["getWorkspacesFromREST"];

  const workspaces: string[] = vscode.workspace.getConfiguration(
    "siebelScriptAndWebTempEditor"
  )["workspaces"];

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

  //clears the tree views
  const clearTreeViews = () => {
    for (let treeDataObj of [
      treeDataBS,
      treeDataBC,
      treeDataApplet,
      treeDataApplication,
      treeDataWebTemp,
    ]) {
      treeDataObj?.refresh?.({});
    }
  };

  //open the extension settings
  const openSettings = () =>
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "siebelScriptAndWebTempEditor"
    );

  //reload the window
  const reloadWindow = () =>
    vscode.commands.executeCommand("workbench.action.reloadWindow");

  if (
    connectionConfigs.length === 0 ||
    (workspaces.length === 0 && !isWorkspaceREST)
  ) {
    openSettings();
    const pullButton = vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pullScript",
      async () => {
        vscode.window.showErrorMessage(ERR_CONN_PARAM_PARSE);
        openSettings();
      }
    );
    context.subscriptions.push(pullButton);

    const pushButton = vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pushScript",
      async () => {
        vscode.window.showErrorMessage(ERR_CONN_PARAM_PARSE);
        openSettings();
      }
    );
    context.subscriptions.push(pushButton);

    //create the webview for the first setup
    const provider: vscode.WebviewViewProvider = {
      resolveWebviewView: (thisWebview: vscode.WebviewView) => {
        thisWebview.webview.options = { enableScripts: true };
        thisWebview.webview.html = webViewHTML({}, {}, NO_REST_CONFIG);
        thisWebview.webview.onDidReceiveMessage(async (message: Message) => {
          switch (message.command) {
            case TEST_REST: {
              const readConfigTestArr: string[] =
                vscode.workspace.getConfiguration(
                  "siebelScriptAndWebTempEditor"
                )["REST EndpointConfigurations"];
              const readWorkspaceTestArr: string =
                vscode.workspace.getConfiguration(
                  "siebelScriptAndWebTempEditor"
                )["workspaces"];
              if (
                readConfigTestArr.length > 0 &&
                readWorkspaceTestArr.length > 0
              ) {
                const [readConfigTest, baseUrl] =
                  readConfigTestArr[0].split("@");
                const [connConf, username, password] =
                  readConfigTest.split("/");
                const [connWS, workspaceTestArr] =
                  readWorkspaceTestArr[0].split(":");
                const workspaceTest =
                  workspaceTestArr && workspaceTestArr.split(",")[0];
                const url = `${baseUrl}/workspace/${workspaceTest}/Application`;
                if (
                  connConf !== connWS ||
                  !(baseUrl && username && password && workspaceTest)
                ) {
                  vscode.window.showErrorMessage(ERR_CONN_PARAM_FORMAT);
                } else {
                  const testResp = await callRESTAPIInstance(
                    { url, username, password },
                    GET,
                    {
                      pageSize: 20,
                      fields: "Name",
                      childLinks: "None",
                      uniformresponse: "y",
                    }
                  );
                  if (testResp.length > 0) {
                    vscode.window.showInformationMessage(
                      "Connection is working!"
                    );
                    thisWebview.webview.html = webViewHTML(
                      {},
                      {},
                      NO_REST_CONFIG,
                      RELOAD_ENABLED
                    );
                  } else {
                    vscode.window.showErrorMessage(ERR_CONN_ERROR);
                  }
                }
              } else {
                vscode.window.showErrorMessage(ERR_NO_CONFIG);
              }
              break;
            }
            case OPEN_CONFIG: {
              //opens the Settings for the extension
              openSettings();
              break;
            }
            case RELOAD: {
              //reloads the extension
              reloadWindow();
              break;
            }
          }
        });
      },
    };
    const extensionView = vscode.window.registerWebviewViewProvider(
      "extensionView",
      provider
    );
    context.subscriptions.push(extensionView);
  } else {
    const defConnNameWSString: string = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ).defaultConnection;
    let [defConnName, defWS] =
      defConnNameWSString && defConnNameWSString.split(":");
    const workspaceObject: Workspaces = {};
    const configData: Connections = {};
    try {
      //create index.d.ts and jsconfig.json if they do not exist
      copyTypeDefFile(context);

      //get workspaces object from the Workspaces setting
      if (!isWorkspaceREST) {
        for (let workspace of workspaces) {
          let [connectionName, workspaceString] = workspace.split(":");
          if (!workspaceString) {
            vscode.window.showErrorMessage(
              `No workspace was found for the ${connectionName} connection, check the Workspaces setting!`
            );
            throw ERROR;
          }
          workspaceObject[connectionName] = [...workspaceString.split(",")];
        }
      }
      //get the connections object
      for (let config of connectionConfigs) {
        let [connUserPwString, url] = config.split("@");
        let [connectionName, username, password] = connUserPwString.split("/");
        if (!(url && username && password)) {
          vscode.window.showErrorMessage(
            `Missing parameter(s) for the ${connectionName} connection, check the REST Endpoint Configurations setting!`
          );
          throw ERROR;
        }
        if (
          !workspaceObject.hasOwnProperty(connectionName) &&
          !isWorkspaceREST
        ) {
          vscode.window.showErrorMessage(
            `No workspace was found for the ${connectionName} connection, check the settings!`
          );
          throw ERROR;
        }
        let connectionObj: Connection & { workspaces: string[] } = {
          username,
          password,
          url,
          workspaces: workspaceObject[connectionName],
        };
        configData[connectionName] = connectionObj;
      }
      //get workspaces from Siebel through REST
      if (isWorkspaceREST) {
        for (let [connectionName, connParams] of Object.entries(configData)) {
          const workspaces = await getWorkspaces(connParams);
          configData[connectionName].workspaces = workspaces;
          if (workspaces.length === 0) {
            delete configData[connectionName];
          }
        }
        if (Object.keys(configData).length === 0) {
          vscode.window.showErrorMessage(ERR_NO_EDITABLE_WS);
          throw ERROR;
        }
      }
    } catch (err: any) {
      openSettings();
      isConfigError = true;
    }
    const firstConnection = Object.keys(configData).includes(defConnName)
      ? defConnName
      : Object.keys(configData)[0];
    const firstWorkspace = configData[firstConnection]?.workspaces?.includes?.(
      defWS
    )
      ? defWS
      : configData[firstConnection]?.workspaces?.[0];
    const selected: Selected = {
      connection: firstConnection,
      workspace: firstWorkspace,
      object: SERVICE_LONG,
      service: { name: "", childName: "" },
      buscomp: { name: "", childName: "" },
      applet: { name: "", childName: "" },
      application: { name: "", childName: "" },
      webtemp: { name: "" },
    };
    let interceptor: number;

    //check if there is error in the format of the settings
    if (!isConfigError && selected.connection) {
      //button to get the focused script from database
      const pullButton = vscode.commands.registerCommand(
        "siebelscriptandwebtempeditor.pullScript",
        async () => {
          const answer = await vscode.window.showInformationMessage(
            "Do you want to overwrite the current script/web template definition from Siebel?",
            "Yes",
            "No"
          );
          if (answer === "Yes") {
            pushOrPullScript(PULL, configData);
          }
        }
      );
      context.subscriptions.push(pullButton);

      //button to update the focused script in the database
      const pushButton = vscode.commands.registerCommand(
        "siebelscriptandwebtempeditor.pushScript",
        async () => {
          const answer = await vscode.window.showInformationMessage(
            "Do you want to overwrite this script/web template definition in Siebel?",
            "Yes",
            "No"
          );
          if (answer === "Yes") {
            pushOrPullScript(PUSH, configData);
          }
        }
      );
      context.subscriptions.push(pushButton);

      //create the interceptor for the default/first connection
      ({ url, username, password } = configData[selected.connection]);
      interceptor = axios.interceptors.request.use((config) => ({
        ...config,
        baseURL: `${url}/workspace/${selected.workspace}`,
        auth: { username, password },
      }));
    } else {
      const pullButton = vscode.commands.registerCommand(
        "siebelscriptandwebtempeditor.pullScript",
        async () => {
          vscode.window.showErrorMessage(ERR_CONN_PARAM_PARSE);
          openSettings();
        }
      );
      context.subscriptions.push(pullButton);

      const pushButton = vscode.commands.registerCommand(
        "siebelscriptandwebtempeditor.pushScript",
        async () => {
          vscode.window.showErrorMessage(ERR_CONN_PARAM_PARSE);
          openSettings();
        }
      );
      context.subscriptions.push(pushButton);
    }

    //handle the datasource selection
    const provider: vscode.WebviewViewProvider = {
      resolveWebviewView: (thisWebview: vscode.WebviewView) => {
        thisWebview.webview.options = { enableScripts: true };
        thisWebview.webview.onDidReceiveMessage(
          async (message: Message) => {
            switch (message.command) {
              case SELECT_CONNECTION: {
                //handle connection selection, create the new interceptor and clear the tree views
                selected.connection = message.connectionName!;
                (selected.workspace =
                  defConnName === selected.connection
                    ? defWS
                    : configData[selected.connection]?.workspaces?.[0]),
                  ({ url, username, password } =
                    configData[selected.connection]);
                axios.interceptors.request.eject(interceptor);
                interceptor = axios.interceptors.request.use((config) => ({
                  ...config,
                  baseURL: `${url}/workspace/${selected.workspace}`,
                  auth: { username, password },
                }));
                vscode.window.showInformationMessage(
                  `Selected connection: ${selected.connection}`
                );
                thisWebview.webview.html = webViewHTML(configData, selected);
                clearTreeViews();
                break;
              }
              case SELECT_WORKSPACE: {
                //handle workspace selection, create the new interceptor and clear the tree views
                selected.workspace = message.workspace!;
                ({ url, username, password } = configData[selected.connection]);
                axios.interceptors.request.eject(interceptor);
                interceptor = axios.interceptors.request.use((config) => ({
                  ...config,
                  baseURL: `${url}/workspace/${selected.workspace}`,
                  auth: { username, password },
                }));
                vscode.window.showInformationMessage(
                  `Selected workspace: ${message.workspace}`
                );
                thisWebview.webview.html = webViewHTML(configData, selected);
                clearTreeViews();
                break;
              }
              case SELECT_OBJECT: {
                //handle Siebel object selection
                selected.object = message.object!;
                thisWebview.webview.html = webViewHTML(configData, selected);
                break;
              }
              case SEARCH: {
                //get the Siebel objects and create the tree views
                const { searchString = "" } = message;
                const searchSpec = `Name LIKE "${searchString}*"`;
                const folderPath = `${selected.connection}/${selected.workspace}`;
                switch (selected.object) {
                  case SERVICE_LONG: {
                    const debouncedSearch = debounceAsync(() =>
                      getSiebelData(searchSpec, folderPath, SERVICE)
                    );
                    const busServObj =
                      (await debouncedSearch()) as ScriptObject;
                    treeDataBS = new TreeDataProvider(busServObj);
                    const treeViewBS = vscode.window.createTreeView(SERVICE, {
                      treeDataProvider: treeDataBS,
                    });

                    treeViewBS.onDidChangeSelection(async (e) =>
                      selectionChange(
                        e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                        SERVICE,
                        selected,
                        busServObj,
                        treeDataBS
                      )
                    );
                    break;
                  }
                  case BUSCOMP_LONG: {
                    const debouncedSearch = debounceAsync(() =>
                      getSiebelData(searchSpec, folderPath, BUSCOMP)
                    );
                    const busCompObj =
                      (await debouncedSearch()) as ScriptObject;
                    treeDataBC = new TreeDataProvider(busCompObj);
                    const treeViewBC = vscode.window.createTreeView(BUSCOMP, {
                      treeDataProvider: treeDataBC,
                    });

                    treeViewBC.onDidChangeSelection(async (e) =>
                      selectionChange(
                        e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                        BUSCOMP,
                        selected,
                        busCompObj,
                        treeDataBC
                      )
                    );
                    break;
                  }
                  case APPLET_LONG: {
                    const debouncedSearch = debounceAsync(() =>
                      getSiebelData(searchSpec, folderPath, APPLET)
                    );
                    const appletObj = (await debouncedSearch()) as ScriptObject;
                    treeDataApplet = new TreeDataProvider(appletObj);
                    const treeViewApplet = vscode.window.createTreeView(
                      APPLET,
                      { treeDataProvider: treeDataApplet }
                    );

                    treeViewApplet.onDidChangeSelection(async (e) =>
                      selectionChange(
                        e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                        APPLET,
                        selected,
                        appletObj,
                        treeDataApplet
                      )
                    );
                    break;
                  }
                  case APPLICATION_LONG: {
                    const debouncedSearch = debounceAsync(() =>
                      getSiebelData(searchSpec, folderPath, APPLICATION)
                    );
                    const applicationObj =
                      (await debouncedSearch()) as ScriptObject;
                    treeDataApplication = new TreeDataProvider(applicationObj);
                    const treeViewApplication = vscode.window.createTreeView(
                      APPLICATION,
                      { treeDataProvider: treeDataApplication }
                    );
                    treeViewApplication.onDidChangeSelection(async (e) =>
                      selectionChange(
                        e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                        APPLICATION,
                        selected,
                        applicationObj,
                        treeDataApplication
                      )
                    );
                    break;
                  }
                  case WEBTEMP_LONG: {
                    const debouncedSearch = debounceAsync(() =>
                      getSiebelData(searchSpec, folderPath, WEBTEMP)
                    );
                    const webTempObj =
                      (await debouncedSearch()) as WebTempObject;
                    treeDataWebTemp = new TreeDataProvider(
                      webTempObj,
                      IS_WEBTEMPLATE
                    );
                    const treeViewWebTemp = vscode.window.createTreeView(
                      WEBTEMP,
                      { treeDataProvider: treeDataWebTemp }
                    );

                    treeViewWebTemp.onDidChangeSelection(async (e) =>
                      selectionChange(
                        e as vscode.TreeViewSelectionChangeEvent<TreeItem>,
                        WEBTEMP,
                        selected,
                        webTempObj,
                        treeDataWebTemp
                      )
                    );
                    break;
                  }
                }
                break;
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
                break;
              }
              case OPEN_CONFIG: {
                //opens the Settings for the extension
                openSettings();
                break;
              }
              case RELOAD: {
                //reloads the extension
                reloadWindow();
                break;
              }
            }
          },
          undefined,
          context.subscriptions
        );
        thisWebview.webview.html = webViewHTML(configData, selected);
      },
    };
    const extensionView = vscode.window.registerWebviewViewProvider(
      "extensionView",
      provider
    );
    context.subscriptions.push(extensionView);
  }
}

export function deactivate() {}
