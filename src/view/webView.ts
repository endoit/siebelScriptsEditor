import * as vscode from "vscode";
import { treeView } from "../tree/treeView";
import { createFolder, getLocalWorkspaces, getHTML } from "../util/file";
import {
  APPLICATION,
  Config,
  getObject,
  joinWorkspace,
  paths,
  queryObject,
  Type,
} from "../util/rest";
import { createValidateWorkspaceName } from "../util/validation";
import { registerCommands, Subscription } from "../util/command";

const siebelEscriptExtensionId = "TitanSystems-DE.siebel-escript",
  installNo = ["Show Extension", "No"] as const,
  deleteNo = ["Delete", "No"] as const,
  configOptions = {
    enableScripts: true,
    retainContextWhenHidden: true,
  } as const,
  dataSourceOptions = { enableScripts: true } as const,
  workspaceDialogOptions = {
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title:
      "Select a workspace folder for the Siebel Script And Web Template Editor extension",
  } as const;

class WebView {
  private static instance: WebView;
  declare private dataSourceView: vscode.Webview;
  declare private dataSourceHTML: string;
  declare private configPanel: vscode.WebviewPanel | undefined;
  declare private configView: vscode.Webview;
  declare private configHTML: string;
  private readonly settings = <Config[]>(
    vscode.workspace
      .getConfiguration("siebelScriptAndWebTempEditor")
      .get("connections")!
  );

  private constructor() {}

  static getInstance() {
    WebView.instance ??= new WebView();
    return WebView.instance;
  }

  init(subscriptions: Subscription[], extensionUri: vscode.Uri) {
    const commands = {
      newWorkspace: this.newWorkspace,
      refreshState: this.refreshState,
      newConnection: this.createConfig(extensionUri, subscriptions, true),
      editConnection: this.createConfig(extensionUri, subscriptions),
    };
    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: vscode.workspace.workspaceFolders?.[0]?.uri
        ? this.createDataSource(extensionUri, subscriptions)
        : this.createOpenWorkspace(extensionUri, subscriptions),
    });
    vscode.workspace.onDidChangeConfiguration(this.refreshConfig);
    registerCommands(subscriptions, commands);
  }

  private newWorkspace = async () => {
    const workspaces = await getLocalWorkspaces(treeView.connection),
      answer = await vscode.window.showInputBox({
        placeHolder: "Enter name of the new workspace",
        validateInput: createValidateWorkspaceName(workspaces),
      });
    if (!answer) return;
    const config = this.getConfig(treeView.connection),
      path = joinWorkspace(answer, APPLICATION),
      response = await getObject(config, path, queryObject.testConnection);
    if (response.length === 0) return;
    treeView.workspace = answer;
    await createFolder(treeView.connection, treeView.workspace);
    await this.refreshState();
  };

  private refreshState = async () => {
    const connections: string[] = [];
    let isConnection = false,
      defaultConnection;
    for (const { name, isDefault } of this.settings) {
      connections.push(name);
      isConnection ||= treeView.connection === name;
      if (isDefault) defaultConnection = name;
    }
    if (connections.length === 0) {
      vscode.window.showErrorMessage(
        "Please create at least one connection with the New Connection button!",
      );
      return this.dataSourceView.postMessage({});
    }
    treeView.connection = isConnection
      ? treeView.connection
      : (defaultConnection ?? connections[0]);
    const config = this.getConfig(treeView.connection);
    if (config.restWorkspaces) {
      const data = await getObject(
        config,
        paths.workspace,
        queryObject.editableWorkspaces,
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

  private openWorkspaceHandler = async () => {
    const folder = await vscode.window.showOpenDialog(workspaceDialogOptions);
    if (!folder || folder.length === 0) return;
    await vscode.commands.executeCommand("vscode.openFolder", folder[0]);
  };

  private dataSourceHandler = async ({
    command,
    data,
  }: {
    command: string;
    data: string;
  }) => {
    switch (command) {
      case "connection":
        treeView.connection = data;
        return await this.refreshState();
      case "workspace":
        treeView.workspace = data;
        return await treeView.setWorkspace();
      case "type":
        treeView.type = <Type>data;
        return;
      case "search":
        return await treeView.search(data);
    }
  };

  private createOpenWorkspace =
    (extensionUri: vscode.Uri, subscriptions: Subscription[]) =>
    async ({ webview }: { webview: vscode.Webview }) => {
      webview.options = dataSourceOptions;
      webview.onDidReceiveMessage(
        this.openWorkspaceHandler,
        undefined,
        subscriptions,
      );
      webview.html = await getHTML(extensionUri, webview, "openWorkspace");
    };

  private createDataSource =
    (extensionUri: vscode.Uri, subscriptions: Subscription[]) =>
    async ({ webview }: { webview: vscode.Webview }) => {
      this.dataSourceView ??= webview;
      this.dataSourceView.options = dataSourceOptions;
      this.dataSourceView.onDidReceiveMessage(
        this.dataSourceHandler,
        undefined,
        subscriptions,
      );
      this.dataSourceHTML ??= await getHTML(
        extensionUri,
        webview,
        "dataSource",
      );
      this.dataSourceView.html = this.dataSourceHTML;
      await this.refreshState();
    };

  private checkEscriptExtension = async () => {
    if (vscode.extensions.getExtension(siebelEscriptExtensionId)) return;
    const answer = await vscode.window.showInformationMessage(
      "For the best experience with the eScript file extension, it is recommended to also install the Siebel eScript extension.",
      ...installNo,
    );
    if (answer !== "Show Extension") return;
    await vscode.commands.executeCommand(
      "extension.open",
      siebelEscriptExtensionId,
    );
  };

  private configHandler = async ({
    command,
    name,
    url,
    username,
    password,
    fileExtension = "js",
    maxPageSize = "100",
    restWorkspaces,
    isDefault,
  }: { command: string } & Config) => {
    const config = this.getConfig(name);
    switch (command) {
      case "testConnection":
        const testResponse = await getObject(
          { url, username, password, fileExtension, maxPageSize },
          paths.test,
          queryObject.testConnection,
        );
        if (testResponse.length > 0)
          vscode.window.showInformationMessage("Connection is working!");
        return;
      case "testRestWorkspaces":
        if (!restWorkspaces) return;
        const response = await getObject(
            { url, username, password, fileExtension, maxPageSize },
            paths.workspace,
            queryObject.allWorkspaces,
          ),
          uncheck = response.length === 0;
        if (uncheck) return await this.configView.postMessage({ uncheck });
        return vscode.window.showInformationMessage(
          "Getting workspaces from the Siebel REST API was successful!",
        );
      case "newConnection":
        const connectionExists = Object.keys(this.getConfig(name)).length > 0;
        if (connectionExists)
          return vscode.window.showErrorMessage(
            "Connection with the same name already exists!",
          );
        config.name = name;
        this.settings.unshift(config);
        treeView.connection = name;
      case "editConnection":
        config.url = url;
        config.username = username;
        config.password = password;
        config.fileExtension = fileExtension;
        config.maxPageSize = maxPageSize;
        config.restWorkspaces = restWorkspaces;
        if (isDefault) {
          for (const item of this.settings) {
            item.isDefault = config === item;
          }
        }
        await this.setConfigs();
        this.configPanel?.dispose();
        if (fileExtension === "escript") await this.checkEscriptExtension();
        return;
      case "deleteConnection":
        const answer = await vscode.window.showInformationMessage(
          `Do you want to delete the ${name} connection?`,
          ...deleteNo,
        );
        if (answer !== "Delete") return;
        for (const [index, item] of this.settings.entries()) {
          if (item.name !== name) continue;
          this.settings.splice(index, 1);
          break;
        }
        await this.setConfigs();
        return this.configPanel?.dispose();
    }
  };

  private createConfig =
    (extensionUri: vscode.Uri, subscriptions: Subscription[], isNew = false) =>
    async () => {
      const columnToShowIn = vscode.window.activeTextEditor?.viewColumn,
        isPanel = this.configPanel !== undefined,
        config =
          isNew || this.settings.length === 0
            ? <Config>{}
            : this.getConfig(treeView.connection);
      this.configPanel ??= vscode.window.createWebviewPanel(
        "configureConnection",
        "Configure Connection",
        columnToShowIn ?? vscode.ViewColumn.One,
        configOptions,
      );
      this.configView = this.configPanel.webview;
      this.configHTML ??= await getHTML(
        extensionUri,
        this.configView,
        "config",
      );
      this.configView.html = this.configHTML;
      await this.configView.postMessage(config);
      if (isPanel) return this.configPanel.reveal(columnToShowIn);
      this.configPanel.onDidDispose(
        () => (this.configPanel = undefined),
        null,
        subscriptions,
      );
      this.configView.onDidReceiveMessage(
        this.configHandler,
        undefined,
        subscriptions,
      );
    };

  private refreshConfig = async (event: vscode.ConfigurationChangeEvent) => {
    if (!event.affectsConfiguration("siebelScriptAndWebTempEditor")) return;
    await this.refreshState();
  };

  private setConfigs = async () =>
    await vscode.workspace
      .getConfiguration("siebelScriptAndWebTempEditor")
      .update("connections", this.settings, vscode.ConfigurationTarget.Global);

  getConfig = (name: string) => {
    for (const config of this.settings) {
      if (config.name !== name) continue;
      return config;
    }
    return <Config>{};
  };
}

export const webView = WebView.getInstance();
