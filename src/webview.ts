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
  configChange,
  getConfig,
  setConfigs,
  settings,
} from "./utils";
import { treeView } from "./treeView";

let dataSourceView: vscode.Webview,
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
    isConnection ||= treeView.connection === name;
    if (isDefault) defaultConnection = name;
  }
  if (connections.length === 0) {
    vscode.window.showErrorMessage(error.noConnection);
    return dataSourceView.postMessage({});
  }
  treeView.connection = isConnection
    ? treeView.connection
    : defaultConnection ?? connections[0];
  const config = getConfig(treeView.connection);
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
      await createFolder(treeView.connection, Name);
    }
  }
  const workspaces = await getLocalWorkspaces(treeView.connection);
  treeView.workspace = workspaces.includes(treeView.workspace)
    ? treeView.workspace
    : workspaces[0];
  await treeView.setConfig(config);
  return await dataSourceView.postMessage({
    connections,
    connection: treeView.connection,
    workspaces,
    workspace: treeView.workspace,
    type: treeView.type,
  });
};

export const refreshConfig = async (event: vscode.ConfigurationChangeEvent) => {
  if (!configChange(event)) return;
  await refreshState();
};

export const newWorkspace = async () => {
  const workspaces = await getLocalWorkspaces(treeView.connection),
    answer = await vscode.window.showInputBox({
      placeHolder: "Enter name of the new workspace",
      validateInput: createValidateWorkspaceName(workspaces),
    });
  if (!answer) return;
  const config = getConfig(treeView.connection),
    path = `workspace/${answer}/Application`,
    response = await getObject("testConnection", config, path);
  if (response.length === 0) return;
  treeView.workspace = answer;
  const folderUri = vscode.Uri.joinPath(
    workspaceUri,
    treeView.connection,
    treeView.workspace
  );
  await vscode.workspace.fs.createDirectory(folderUri);
  await refreshState();
};

const dataSourceHandler = async ({ command, data }: DataSourceMessage) => {
  switch (command) {
    case "connection":
      treeView.connection = data;
      return await refreshState();
    case "workspace":
      treeView.workspace = data;
      return await treeView.setWorkspace();
    case "type":
      return (treeView.type = data);
    case "search":
      return await treeView.search(data);
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
      if (uncheck) return await configView.postMessage({ uncheck });
      return vscode.window.showInformationMessage(
        "Getting workspaces from the Siebel REST API was successful!"
      );
    case "newConnection":
      const connectionExists = Object.keys(getConfig(name)).length > 0;
      if (connectionExists)
        return vscode.window.showErrorMessage(error.connectionExists);
      config.name = name;
      configs.unshift(config);
      treeView.connection = name;
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
      config = isNew ? <Config>{} : getConfig(treeView.connection);
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
