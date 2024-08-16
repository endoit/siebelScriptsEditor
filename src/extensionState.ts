import * as vscode from "vscode";
import { query, paths, error } from "./constants";
import { callRestApi, pushOrPull, setupWorkspaceFolder } from "./utils";
import {
  configChange,
  getConnection,
  moveDeprecatedSettings,
  openSettings,
  setConnections,
  setDefaultConnectionName,
  settings,
} from "./settings";
import axios from "axios";
import { dataSourceHTML, configHTML } from "./webViews";
import { TreeData } from "./treeData";

const treeData = {
  service: new TreeData("service"),
  buscomp: new TreeData("buscomp"),
  applet: new TreeData("applet"),
  application: new TreeData("application"),
  webtemp: new TreeData("webtemp"),
} as const;
let configWebviewPanel: vscode.WebviewPanel | undefined,
  connection = "",
  workspace = "",
  type: SiebelObject = "service";
axios.defaults.method = "get";
axios.defaults.withCredentials = true;

export const initialize = async (context: vscode.ExtensionContext) => {
  await moveDeprecatedSettings();
  await setupWorkspaceFolder(context);

  vscode.window.registerWebviewViewProvider("extensionView", {
    resolveWebviewView: dataSourceWebview(context),
  });

  const commands = {
    pull: pushOrPull("pull"),
    push: pushOrPull("push"),
    newConnection: configWebview(context, true),
    editConnection: configWebview(context),
    openSettings,
  } as const;

  for (const [command, callback] of Object.entries(commands)) {
    vscode.commands.registerCommand(
      `siebelscriptandwebtempeditor.${command}`,
      callback
    );
  }
};

const setWorkspace = (newWorkspace: string) => {
  workspace = newWorkspace;
  const { url, username, password } = getConnection(connection),
    folderUri = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders![0].uri,
      connection,
      workspace
    );
  axios.defaults.baseURL = [url, "workspace", workspace].join("/");
  axios.defaults.auth = { username, password };
  axios.defaults.params = {
    uniformresponse: "y",
    childlinks: "None",
    PageSize: settings.maxPageSize,
  };
  for (const treeDataProvider of Object.values(treeData)) {
    treeDataProvider.setFolder(folderUri);
  }
};

const getWorkspacesFromRest = async (
  url: string,
  username: string,
  password: string
) => {
  const request: RequestConfig = {
      method: "get",
      url: [url, paths.restWorkspaces].join("/"),
      auth: { username, password },
      params: query.restWorkspaces,
    },
    data = await callRestApi("restWorkspaces", request),
    workspaces = [];
  for (const { Name } of data) {
    workspaces.push(Name);
  }
  return workspaces;
};

const setConnection = async (newConnection?: string) => {
  const connections = [],
    defaultConnectionName = settings.defaultConnectionName;
  for (const { name } of settings.connections) {
    connections.push(name);
  }
  if (connections.length === 0) {
    vscode.window.showErrorMessage(error.noConnection);
    return {};
  }
  connection = newConnection
    ? newConnection
    : connections.includes(connection)
    ? connection
    : connections.includes(defaultConnectionName)
    ? defaultConnectionName
    : connections[0];
  const {
      url,
      username,
      password,
      workspaces,
      defaultWorkspace,
      restWorkspaces,
    } = getConnection(connection),
    newWorkspaces = restWorkspaces
      ? await getWorkspacesFromRest(url, username, password)
      : workspaces,
    newWorkspace = newWorkspaces.includes(workspace)
      ? workspace
      : restWorkspaces || !newWorkspaces.includes(defaultWorkspace)
      ? newWorkspaces?.[0] ?? ""
      : defaultWorkspace;
  setWorkspace(newWorkspace);
  return {
    connections,
    connection,
    workspaces: newWorkspaces,
    workspace,
    type,
  };
};

const dataSourceWebview =
  (context: vscode.ExtensionContext) =>
  async ({ webview }: { webview: vscode.Webview }) => {
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!configChange(e)) return;
      await webview.postMessage(await setConnection());
    });
    webview.options = { enableScripts: true };
    webview.onDidReceiveMessage(
      async ({ command, data }: DataSourceMessage) => {
        switch (command) {
          case "connection":
            return await webview.postMessage(await setConnection(data));
          case "workspace":
            return setWorkspace(data);
          case "type":
            return (type = data);
          case "search":
            return await treeData[type].search(data);
        }
      },
      undefined,
      context.subscriptions
    );
    webview.html = dataSourceHTML;
    await webview.postMessage(await setConnection());
  };

const configWebview =
  (context: vscode.ExtensionContext, isNewConnection = false) =>
  async () => {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (!isNewConnection) isNewConnection = settings.connections.length === 0;
    if (configWebviewPanel) {
      configWebviewPanel.webview.html = configHTML(connection, isNewConnection);
      return configWebviewPanel.reveal(columnToShowIn);
    }
    configWebviewPanel = vscode.window.createWebviewPanel(
      "configureConnection",
      "Configure Connection",
      columnToShowIn ?? vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    configWebviewPanel.webview.html = configHTML(connection, isNewConnection);
    configWebviewPanel.onDidDispose(
      () => (configWebviewPanel = undefined),
      null,
      context.subscriptions
    );
    configWebviewPanel.webview.onDidReceiveMessage(
      async ({
        command,
        action,
        workspace,
        name,
        url,
        username,
        password,
        restWorkspaces,
        defaultConnection,
      }: ConfigMessage) => {
        const connections = settings.connections,
          connection = getConnection(name);
        switch (command) {
          case "workspace":
            const { workspaces } = connection;
            switch (action) {
              case "add":
                if (workspaces.includes(workspace)) return;
                workspaces.unshift(workspace);
                if (workspaces.length !== 1) break;
              case "default":
                connection.defaultWorkspace = workspace;
                break;
              case "delete":
                workspaces.splice(workspaces.indexOf(workspace), 1);
                if (connection.defaultWorkspace === workspace)
                  connection.defaultWorkspace = workspaces[0] ?? "";
                break;
            }
            await setConnections(connections);
            return (configWebviewPanel!.webview.html = configHTML(name));
          case "testConnection":
          case "testRestWorkspaces":
            if (!(url && username && password))
              return vscode.window.showErrorMessage(error.missingParameters);
            const request: RequestConfig = {
              method: "get",
              url: [url, paths[command]].join("/"),
              auth: { username, password },
              params: query[command],
            };
            return await callRestApi(command, request);
          case "newOrEditConnection":
            if (!(name && url && username && password))
              return vscode.window.showErrorMessage(error.missingParameters);
            if (connection.name) {
              connection.url = url;
              connection.username = username;
              connection.password = password;
              connection.restWorkspaces = restWorkspaces;
              await setConnections(connections);
              if (defaultConnection) await setDefaultConnectionName(name);
              return configWebviewPanel?.dispose();
            }
            connections.unshift({
              name,
              url,
              username,
              password,
              restWorkspaces,
              workspaces: [],
              defaultWorkspace: "",
            });
            await setConnections(connections);
            return (configWebviewPanel!.webview.html = configHTML(name));
          case "deleteConnection":
            const answer = await vscode.window.showInformationMessage(
              `Do you want to delete the ${name} connection?`,
              "Yes",
              "No"
            );
            if (answer !== "Yes") return;
            let index = 0;
            for (index; index < connections.length; index++) {
              if (connections[index].name === name) break;
              if (index + 1 === connections.length) return;
            }
            connections.splice(index, 1);
            await setConnections(connections);
            return configWebviewPanel?.dispose();
        }
      },
      undefined,
      context.subscriptions
    );
  };
