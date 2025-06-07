import * as vscode from "vscode";
import {
  paths,
  error,
  yesNo,
  configOptions,
  dataSourceOptions,
} from "./constants";
import {
  workspaceUri,
  getObject,
  setButtonVisibility,
  getLocalWorkspaces,
  createValidateWorkspaceName,
  createFolder,
} from "./utils";
import { configChange, getConfig, setConfigs, settings } from "./settings";
import {
  dataSourceHTML,
  createConfigHTML,
  noWorkspaceFolderHTML,
} from "./webViews";
import { treeView } from "./treeView";

let connection = "",
  workspace = "",
  type: Type = "service",
  dataSourceView: vscode.Webview,
  configPanel: vscode.WebviewPanel | undefined,
  configView: vscode.Webview;

export const refreshConnections = async () => {
  const connections: string[] = [];
  let isConnection = false,
    defaultConnection;
  for (const { name, isDefault } of settings.connections) {
    connections.push(name);
    isConnection ||= connection === name;
    if (isDefault) defaultConnection = name;
  }
  if (connections.length === 0) {
    vscode.window.showErrorMessage(error.noConnection);
    return dataSourceView.postMessage({});
  }
  connection = isConnection ? connection : defaultConnection ?? connections[0];
  const { url, username, password, restWorkspaces } = getConfig(connection);
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
      await createFolder(connection, Name);
    }
  }
  const workspaces = await getLocalWorkspaces(connection);
  workspace = workspaces.includes(workspace) ? workspace : workspaces[0];
  treeView.restDefaults = { url, username, password };
  await treeView.reset(connection, workspace);
  setButtonVisibility("refresh", restWorkspaces);
  return await dataSourceView.postMessage({
    connections,
    connection,
    workspaces,
    workspace,
    type,
  });
};

export const refreshConfig = async (event: vscode.ConfigurationChangeEvent) => {
  if (!configChange(event)) return;
  await refreshConnections();
};

export const newWorkspace = async () => {
  const workspaces = await getLocalWorkspaces(connection),
    answer = await vscode.window.showInputBox({
      placeHolder: "Enter new workspace name",
      validateInput: createValidateWorkspaceName(workspaces),
    });
  if (!answer) return;
  workspace = answer;
  const folderUri = vscode.Uri.joinPath(workspaceUri, connection, workspace);
  await vscode.workspace.fs.createDirectory(folderUri);
  await refreshConnections();
};

const dataSourceHandler = async ({ command, data }: DataSourceMessage) => {
  switch (command) {
    case "connection":
      connection = data;
      return await refreshConnections();
    case "workspace":
      workspace = data;
      return await treeView.reset(connection, workspace);
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
    dataSourceView.options = dataSourceOptions;
    dataSourceView.onDidReceiveMessage(
      dataSourceHandler,
      undefined,
      subscriptions
    );
    dataSourceView.html = dataSourceHTML;
    await refreshConnections();
  };

const configHandler = async ({
  command,
  name,
  url,
  username,
  password,
  restWorkspaces,
  isDefault,
}: ConfigMessage) => {
  const configs = settings.connections,
    config = getConfig(name);
  switch (command) {
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
      configs.unshift(config);
    case "editConnection":
      config.url = url;
      config.username = username;
      config.password = password;
      config.restWorkspaces = restWorkspaces;
      if (isDefault)
        configs.forEach((configItem) => {
          console.log({ a: config === configItem, b: configItem.name });
          configItem.isDefault = config === configItem;
        });
      console.log(config.isDefault);
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
