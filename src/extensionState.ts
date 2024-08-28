import * as vscode from "vscode";
import { query, paths, error } from "./constants";
import { callRestApi } from "./utils";
import {
  configChange,
  getConnection,
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
  } as const,
  workspaceUri = vscode.workspace.workspaceFolders![0].uri;
let connections: string[] = [],
  connection = "",
  workspaces: string[] = [],
  workspace = "",
  type: SiebelObject = "service",
  baseUrl: string,
  configWebviewPanel: vscode.WebviewPanel | undefined;
axios.defaults.method = "get";
axios.defaults.withCredentials = true;

const setUrlAndFolder = () => {
  axios.defaults.baseURL = [baseUrl, "workspace", workspace].join("/");
  for (const [type, treeDataProvider] of Object.entries(treeData)) {
    treeDataProvider.folder = vscode.Uri.joinPath(
      workspaceUri,
      connection,
      workspace,
      type
    );
    treeDataProvider.clear();
  }
};

const getState = async () => {
  const defaultConnectionName = settings.defaultConnectionName;
  connections = [];
  let isConnection = false,
    isDefault = false;
  for (const { name } of settings.connections) {
    connections.push(name);
    if (!isConnection && connection === name) isConnection = true;
    if (!isDefault && defaultConnectionName === name) isDefault = true;
  }
  if (connections.length === 0) {
    vscode.window.showErrorMessage(error.noConnection);
    return {};
  }
  connection = isConnection
    ? connection
    : isDefault
    ? defaultConnectionName
    : connections[0];
  const {
    url,
    username,
    password,
    workspaces: newWorkspaces,
    defaultWorkspace,
    restWorkspaces,
  } = getConnection(connection);
  workspaces = restWorkspaces ? [] : newWorkspaces;
  if (restWorkspaces) {
    const request: RequestConfig = {
        method: "get",
        url: [url, paths.restWorkspaces].join("/"),
        auth: { username, password },
        params: query.restWorkspaces,
      },
      data = await callRestApi("restWorkspaces", request);
    for (const { Name } of data) {
      workspaces.push(Name);
    }
  }
  workspace = workspaces.includes(workspace)
    ? workspace
    : restWorkspaces || !workspaces.includes(defaultWorkspace)
    ? workspaces?.[0] ?? ""
    : defaultWorkspace;
  axios.defaults.auth = { username, password };
  axios.defaults.params = {
    uniformresponse: "y",
    childlinks: "None",
    PageSize: settings.maxPageSize,
  };
  baseUrl = url;
  setUrlAndFolder();
  return { connections, connection, workspaces, workspace, type };
};

export const dataSourceWebview =
  (context: vscode.ExtensionContext) =>
  async ({ webview }: { webview: vscode.Webview }) => {
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!configChange(e)) return;
      await webview.postMessage(await getState());
    });
    webview.options = { enableScripts: true };
    webview.onDidReceiveMessage(
      async ({ command, data }: DataSourceMessage) => {
        switch (command) {
          case "connection":
            connection = data;
            return await webview.postMessage(await getState());
          case "workspace":
            workspace = data;
            return setUrlAndFolder();
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
    await webview.postMessage(await getState());
  };

export const configWebview =
  (context: vscode.ExtensionContext, isNew = false) =>
  async () => {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (!isNew) isNew = settings.connections.length === 0;
    if (configWebviewPanel) {
      configWebviewPanel.webview.html = configHTML(connection, isNew);
      return configWebviewPanel.reveal(columnToShowIn);
    }
    configWebviewPanel = vscode.window.createWebviewPanel(
      "configureConnection",
      "Configure Connection",
      columnToShowIn ?? vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    configWebviewPanel.webview.html = configHTML(connection, isNew);
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
              if (isNew)
                return vscode.window.showErrorMessage(error.connectionExists);
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
