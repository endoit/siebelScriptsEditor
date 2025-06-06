import * as vscode from "vscode";
import {
  paths,
  error,
  yesNo,
  configOptions,
  dataSourceOptions,
} from "./constants";
import { workspaceUri, getObject, setButtonVisibility } from "./utils";
import {
  configChange,
  getConfig,
  setConfigs,
  setDefaultConnection,
  settings,
} from "./settings";
import {
  dataSourceHTML,
  createConfigHTML,
  noWorkspaceFolderHTML,
} from "./webViews";
import { TreeView } from "./treeView";

const treeView = TreeView.getInstance();

let connection = "",
  workspace = "",
  type: Type = "service",
  dataSourceView: vscode.Webview,
  configPanel: vscode.WebviewPanel | undefined,
  configView: vscode.Webview;

const setUrlAndFolder = async () => {
  TreeView.workspaceUrl = workspace;
  await treeView.setFolder(connection, workspace);
};

export const refreshConnections = async () => {
  const connections: string[] = [];
  let isConnection = false,
    isDefault = false,
    workspaces: string[] = [];
  for (const { name } of settings.connections) {
    connections.push(name);
    isConnection ||= connection === name;
    isDefault ||= settings.defaultConnectionName === name;
  }
  if (connections.length === 0) {
    vscode.window.showErrorMessage(error.noConnection);
    return dataSourceView.postMessage({});
  }
  connection = isConnection
    ? connection
    : isDefault
    ? settings.defaultConnectionName
    : connections[0];
  const {
    url,
    username,
    password,
    workspaces: workspaceList,
    defaultWorkspace,
    restWorkspaces,
  } = getConfig(connection);
  workspaces = [];
  if (restWorkspaces) {
    const data = await getObject(
      "editableWorkspaces",
      { url, username, password },
      paths.workspaces
    );
    while (data.length > 0) {
      const { Name, RepositoryWorkspace } = data.pop()!;
      if (RepositoryWorkspace) data.push(...RepositoryWorkspace);
      if (!Name.includes(username.toLowerCase())) continue;
      workspaces.push(Name);
    }
  }
  workspaces = workspaces.length > 0 ? workspaces : workspaceList;
  workspace = workspaces.includes(workspace)
    ? workspace
    : restWorkspaces || !workspaces.includes(defaultWorkspace)
    ? workspaces?.[0] ?? ""
    : defaultWorkspace;
  TreeView.restDefaults = { url, username, password };
  await setUrlAndFolder();
  setButtonVisibility("refresh", restWorkspaces);
  return await dataSourceView.postMessage({
    connections,
    connection,
    workspaces,
    workspace,
    type,
  });
};

const dataSourceHandler = async ({ command, data }: DataSourceMessage) => {
  switch (command) {
    case "connection":
      connection = data;
      return await refreshConnections();
    case "workspace":
      workspace = data;
      return await setUrlAndFolder();
    case "type":
      return (type = data);
    case "search":
      if (data.length > 0 && data.length < 3) return;
      return await treeView.search(type, data);
  }
};

export const createDataSource =
  (subscriptions: Subscriptions) =>
  async ({ webview }: { webview: vscode.Webview }) => {
    if (!workspaceUri) return void (webview.html = noWorkspaceFolderHTML);
    if (!dataSourceView) dataSourceView = webview;
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!configChange(e)) return;
      await refreshConnections();
    });
    dataSourceView.options = dataSourceOptions;
    dataSourceView.onDidReceiveMessage(
      dataSourceHandler,
      undefined,
      subscriptions
    );
    dataSourceView.html = dataSourceHTML;
    await refreshConnections();
  };

const workspaceHandler = async (
  action: WorkspaceAction,
  workspaceName: string,
  config: Config
) => {
  switch (action) {
    case "add":
      config.workspaces.unshift(workspaceName);
      if (!config.workspaces.includes("MAIN")) config.workspaces.push("MAIN");
    case "default":
      config.defaultWorkspace = workspaceName;
      if (config.name === connection) workspace = workspaceName;
      return await refreshConnections();
    case "delete":
      const index = config.workspaces.indexOf(workspaceName);
      if (index === -1) return;
      config.workspaces.splice(index, 1);
      if (config.defaultWorkspace === workspaceName)
        config.defaultWorkspace = config.workspaces[0] ?? "";
      return;
  }
};

const configHandler = async ({
  command,
  action,
  workspace,
  name,
  url,
  username,
  password,
  restWorkspaces,
  isDefaultConnection,
}: ConfigMessage) => {
  const configs = settings.connections,
    config = getConfig(name);
  switch (command) {
    case "workspace":
      workspaceHandler(action, workspace, config);
      configView.html = createConfigHTML(config);
      return await setConfigs(configs);
    case "testConnection":
      const testResponse = await getObject(
        "testConnection",
        { url, username, password },
        paths.test
      );
      if (testResponse.length > 0)
        vscode.window.showInformationMessage("Connection is working!");
      return;
    case "testRestWorkspaces":
      const response = await getObject(
          "allWorkspaces",
          { url, username, password },
          paths.workspaces
        ),
        uncheck = response.length === 0;
      if (!uncheck)
        vscode.window.showInformationMessage(
          "Getting workspaces from the Siebel REST API was successful!"
        );
      return await configView.postMessage({ uncheck });
    case "newConnection":
      const connectionExists = Object.keys(getConfig(name)).length > 0;
      if (connectionExists)
        return vscode.window.showErrorMessage(error.connectionExists);
      config.name = name;
      config.workspaces = ["MAIN"];
      configs.unshift(config);
    case "editConnection":
      config.url = url;
      config.username = username;
      config.password = password;
      config.restWorkspaces = restWorkspaces;
      if (isDefaultConnection) await setDefaultConnection(name);
      await setConfigs(configs);
      if (command === "editConnection") return configPanel?.dispose();
      return (configView.html = createConfigHTML(config));
    case "deleteConnection":
      const answer = await vscode.window.showInformationMessage(
        `Do you want to delete the ${name} connection?`,
        ...yesNo
      );
      if (answer !== "Yes") return;
      const index = configs.findIndex(({ name: item }) => item === name);
      if (index === -1) return;
      configs.splice(index, 1);
      await setConfigs(configs);
      return configPanel?.dispose();
  }
};

export const createConfig =
  (subscriptions: Subscriptions, configType: "new" | "edit") => async () => {
    const columnToShowIn = vscode.window.activeTextEditor?.viewColumn,
      isPanel = configPanel !== undefined,
      isNew = configType === "new" || settings.connections.length === 0,
      config = isNew ? <Config>{} : getConfig(connection);
    configPanel ??= vscode.window.createWebviewPanel(
      "configureConnection",
      "Configure Connection",
      columnToShowIn ?? vscode.ViewColumn.One,
      configOptions
    );
    configView = configPanel.webview;
    configView.html = createConfigHTML(config, isNew);
    if (isPanel) return configPanel.reveal(columnToShowIn);
    configPanel.onDidDispose(
      () => (configPanel = undefined),
      null,
      subscriptions
    );
    configView.onDidReceiveMessage(configHandler, undefined, subscriptions);
  };
