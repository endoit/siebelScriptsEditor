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
  getLocalWorkspaces,
  createValidateWorkspaceName,
  createFolder,
  getHTML,
  openWorkspace,
} from "./utils";
import { configChange, getConfig, setConfigs, settings } from "./settings";
import { treeView } from "./treeView";

let connection = "",
  workspace = "",
  type: Type = "service",
  dataSourceView: vscode.Webview,
  dataSourceHTML: string,
  configPanel: vscode.WebviewPanel | undefined,
  configView: vscode.Webview,
  configHTML: string;

export const refreshState = async () => {
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
  const config = getConfig(connection);
  if (config.restWorkspaces) {
    const data = await getObject(
      "editableWorkspaces",
      config,
      paths.workspaces
    );
    while (data.length > 0) {
      const { Name, RepositoryWorkspace } = data.pop()!;
      if (RepositoryWorkspace) data.push(...RepositoryWorkspace);
      if (!Name.includes(config.username.toLowerCase())) continue;
      await createFolder(connection, Name);
    }
  }
  const workspaces = await getLocalWorkspaces(connection);
  workspace = workspaces.includes(workspace) ? workspace : workspaces[0];
  await treeView.setConfig(config, connection, workspace);
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
  await refreshState();
};

export const newWorkspace = async () => {
  const workspaces = await getLocalWorkspaces(connection),
    answer = await vscode.window.showInputBox({
      placeHolder: "Enter name of the new workspace",
      validateInput: createValidateWorkspaceName(workspaces),
    });
  if (!answer) return;
  const config = getConfig(connection),
    path = `workspace/${answer}/Application`,
    response = await getObject("testConnection", config, path);
  if (response.length === 0)
    return vscode.window.showErrorMessage(
      `Workspace ${answer} does not exist in the ${connection} connection!`
    );
  workspace = answer;
  const folderUri = vscode.Uri.joinPath(workspaceUri, connection, workspace);
  await vscode.workspace.fs.createDirectory(folderUri);
  await refreshState();
};

const dataSourceHandler = async ({ command, data }: DataSourceMessage) => {
  switch (command) {
    case "connection":
      connection = data;
      return await refreshState();
    case "workspace":
      workspace = data;
      return await treeView.setWorkspace(connection, workspace);
    case "type":
      return (type = data);
    case "search":
      //if (data.length > 0 && data.length < 3) return;
      return await treeView.search(type, data);
  }
};

export const createDataSource =
  (extensionUri: vscode.Uri, subscriptions: Subscriptions) =>
  async ({ webview }: { webview: vscode.Webview }) => {
    if (!workspaceUri)
      return openWorkspace(extensionUri, subscriptions, webview);
    if (!dataSourceView) dataSourceView = webview;
    dataSourceView.options = dataSourceOptions;
    dataSourceView.onDidReceiveMessage(
      dataSourceHandler,
      undefined,
      subscriptions
    );
    dataSourceHTML ??= await getHTML(extensionUri, webview, "dataSource");
    dataSourceView.html = dataSourceHTML;
    await refreshState();
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
      if (!restWorkspaces) return;
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
      connection = name;
    case "editConnection":
      config.url = url;
      config.username = username;
      config.password = password;
      config.restWorkspaces = restWorkspaces;
      if (isDefault)
        configs.forEach(
          (configItem) => (configItem.isDefault = config === configItem)
        );
      await setConfigs(configs);
      return configPanel?.dispose();
    case "deleteConnection":
      const answer = await vscode.window.showInformationMessage(
        `Do you want to delete the ${name} connection?`,
        ...yesNo
      );
      if (answer !== "Yes") return;
      const newConfigs = configs.filter((configItem) => config !== configItem);
      await setConfigs(newConfigs);
      return configPanel?.dispose();
  }
};

export const createConfig =
  (
    extensionUri: vscode.Uri,
    subscriptions: Subscriptions,
    configType: "new" | "edit"
  ) =>
  async () => {
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
    configHTML ??= await getHTML(extensionUri, configView, "config");
    configView.html = configHTML;
    await configView.postMessage(config);
    if (isPanel) return configPanel.reveal(columnToShowIn);
    configPanel.onDidDispose(
      () => (configPanel = undefined),
      null,
      subscriptions
    );
    configView.onDidReceiveMessage(configHandler, undefined, subscriptions);
  };
