import * as vscode from "vscode";
import {
  paths,
  error,
  deleteNo,
  configOptions,
  settings,
  dataSourceOptions,
  workspaceUri,
  workspaceDialogOptions,
} from "./constants";
import {
  getObject,
  getLocalWorkspaces,
  createValidateWorkspaceName,
  createFolder,
  getHTML,
  getConfig,
  setConfigs,
} from "./utils";
import { treeView } from "./treeView";

class WebView {
  private static instance: WebView;
  private declare dataSourceView: vscode.Webview;
  private declare dataSourceHTML: string;
  private declare configPanel: vscode.WebviewPanel | undefined;
  private declare configView: vscode.Webview;
  private declare configHTML: string;

  static getInstance() {
    WebView.instance ??= new WebView();
    return WebView.instance;
  }

  refreshState = async () => {
    const connections: string[] = [];
    let isConnection = false,
      defaultConnection;
    for (const { name, isDefault } of settings) {
      connections.push(name);
      isConnection ||= treeView.connection === name;
      if (isDefault) defaultConnection = name;
    }
    if (connections.length === 0) {
      vscode.window.showErrorMessage(error.noConnection);
      return this.dataSourceView.postMessage({});
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
    return await this.dataSourceView.postMessage({
      connections,
      connection: treeView.connection,
      workspaces,
      workspace: treeView.workspace,
      type: treeView.type,
    });
  };

  refreshConfig = async (event: vscode.ConfigurationChangeEvent) => {
    if (!event.affectsConfiguration("siebelScriptAndWebTempEditor")) return;
    await this.refreshState();
  };

  newWorkspace = async () => {
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
    await this.refreshState();
  };

  openWorkspaceHandler = async () => {
    const folder = await vscode.window.showOpenDialog(workspaceDialogOptions);
    if (!folder || folder.length === 0) return;
    await vscode.commands.executeCommand("vscode.openFolder", folder[0]);
  };

  dataSourceHandler = async ({ command, data }: DataSourceMessage) => {
    switch (command) {
      case "connection":
        treeView.connection = data;
        return await this.refreshState();
      case "workspace":
        treeView.workspace = data;
        return await treeView.setWorkspace();
      case "type":
        treeView.type = data;
        return;
      case "search":
        return await treeView.search(data);
    }
  };

  createDataSource =
    (extensionUri: vscode.Uri, subscriptions: Subscriptions) =>
    async ({ webview }: { webview: vscode.Webview }) => {
      if (!workspaceUri) {
        webview.options = dataSourceOptions;
        webview.onDidReceiveMessage(
          this.openWorkspaceHandler,
          undefined,
          subscriptions
        );
        webview.html = await getHTML(extensionUri, webview, "openWorkspace");
        return;
      }
      this.dataSourceView ??= webview;
      this.dataSourceView.options = dataSourceOptions;
      this.dataSourceView.onDidReceiveMessage(
        this.dataSourceHandler,
        undefined,
        subscriptions
      );
      this.dataSourceHTML ??= await getHTML(
        extensionUri,
        webview,
        "dataSource"
      );
      this.dataSourceView.html = this.dataSourceHTML;
      await this.refreshState();
    };

  configHandler = async ({
    command,
    name,
    url,
    username,
    password,
    fileExtension = "js",
    maxPageSize = 100,
    restWorkspaces,
    isDefault,
  }: ConfigMessage) => {
    const configs = settings,
      config = getConfig(name);
    console.log({
      fileExtension,
      maxPageSize,
    });
    switch (command) {
      case "testConnection":
        const testResponse = await getObject(
          "testConnection",
          { url, username, password, fileExtension, maxPageSize },
          paths.test
        );
        if (testResponse.length > 0)
          vscode.window.showInformationMessage("Connection is working!");
        return;
      case "testRestWorkspaces":
        if (!restWorkspaces) return;
        const response = await getObject(
            "allWorkspaces",
            { url, username, password, fileExtension, maxPageSize },
            paths.workspaces
          ),
          uncheck = response.length === 0;
        if (uncheck) return await this.configView.postMessage({ uncheck });
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
        config.fileExtension = fileExtension;
        config.maxPageSize = maxPageSize;
        config.restWorkspaces = restWorkspaces;
        if (isDefault)
          configs.forEach(
            (configItem) => (configItem.isDefault = config === configItem)
          );
        await setConfigs(configs);
        return this.configPanel?.dispose();
      case "deleteConnection":
        const answer = await vscode.window.showInformationMessage(
          `Do you want to delete the ${name} connection?`,
          ...deleteNo
        );
        if (answer !== "Delete") return;
        const newConfigs = configs.filter(
          (configItem) => config !== configItem
        );
        await setConfigs(newConfigs);
        return this.configPanel?.dispose();
    }
  };

  createConfig =
    (
      extensionUri: vscode.Uri,
      subscriptions: Subscriptions,
      configType: "new" | "edit"
    ) =>
    async () => {
      const columnToShowIn = vscode.window.activeTextEditor?.viewColumn,
        isPanel = this.configPanel !== undefined,
        isNew = configType === "new" || settings.length === 0,
        config = isNew ? <Config>{} : getConfig(treeView.connection);
      this.configPanel ??= vscode.window.createWebviewPanel(
        "configureConnection",
        "Configure Connection",
        columnToShowIn ?? vscode.ViewColumn.One,
        configOptions
      );
      this.configView = this.configPanel.webview;
      this.configHTML ??= await getHTML(
        extensionUri,
        this.configView,
        "config"
      );
      this.configView.html = this.configHTML;
      await this.configView.postMessage(config);
      if (isPanel) return this.configPanel.reveal(columnToShowIn);
      this.configPanel.onDidDispose(
        () => (this.configPanel = undefined),
        null,
        subscriptions
      );
      this.configView.onDidReceiveMessage(
        this.configHandler,
        undefined,
        subscriptions
      );
    };
}

export const webView = WebView.getInstance();
