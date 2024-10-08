import * as vscode from "vscode";
import { query, paths, error, yesNo } from "./constants";
import { callRestApi } from "./utils";
import {
  configChange,
  getConfig,
  setConfigs,
  setDefaultConnection,
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
  workspaceUri = vscode.workspace.workspaceFolders?.[0].uri!;
let connections: string[] = [],
  connection = "",
  workspaces: string[] = [],
  workspace = "",
  type: Type = "service",
  baseUrl: string,
  configWebviewPanel: vscode.WebviewPanel | undefined;
axios.defaults.method = "get";
axios.defaults.withCredentials = true;
axios.defaults.params = {
  uniformresponse: "y",
  childlinks: "None",
};

const setUrlAndFolder = () => {
  axios.defaults.baseURL = [baseUrl, "workspace", workspace].join("/");
  for (const [objectType, treeDataProvider] of Object.entries(treeData)) {
    treeDataProvider.folder = vscode.Uri.joinPath(
      workspaceUri,
      connection,
      workspace,
      objectType
    );
  }
};

const getState = async () => {
  let isConnection = false,
    isDefault = false;
  connections = [];
  for (const { name } of settings.connections) {
    connections.push(name);
    isConnection ||= connection === name;
    isDefault ||= settings.defaultConnectionName === name;
  }
  if (connections.length === 0) {
    vscode.window.showErrorMessage(error.noConnection);
    return {};
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
    workspaces: newWorkspaces,
    defaultWorkspace,
    restWorkspaces,
  } = getConfig(connection);
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
  axios.defaults.params.PageSize = settings.maxPageSize;
  baseUrl = url;
  setUrlAndFolder();
  return { connections, connection, workspaces, workspace, type };
};

export const dataSourceWebview =
  (subscriptions: Subscriptions) =>
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
      subscriptions
    );
    webview.html = dataSourceHTML;
    await webview.postMessage(await getState());
  };

export const configWebview =
  (subscriptions: Subscriptions, webviewType: WebviewType) => async () => {
    const columnToShowIn = vscode.window.activeTextEditor?.viewColumn,
      isPanel = configWebviewPanel !== undefined,
      isNew = webviewType === "new" || settings.connections.length === 0,
      config = isNew ? <Config>{} : getConfig(connection);
    configWebviewPanel ??= vscode.window.createWebviewPanel(
      "configureConnection",
      "Configure Connection",
      columnToShowIn ?? vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    const { webview } = configWebviewPanel;
    webview.html = configHTML(config, isNew);
    if (isPanel) return configWebviewPanel.reveal(columnToShowIn);
    configWebviewPanel.onDidDispose(
      () => (configWebviewPanel = undefined),
      null,
      subscriptions
    );
    webview.onDidReceiveMessage(
      async ({
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
            const { workspaces } = config;
            switch (action) {
              case "add":
                if (workspaces.includes(workspace)) return;
                workspaces.unshift(workspace);
                if (workspaces.length !== 1) break;
              case "default":
                config.defaultWorkspace = workspace;
                break;
              case "delete":
                const index = workspaces.indexOf(workspace);
                if (index === -1) return;
                workspaces.splice(index, 1);
                if (config.defaultWorkspace !== workspace) break;
                config.defaultWorkspace = workspaces[0] ?? "";
            }
            webview.html = configHTML(config);
            return await setConfigs(configs);
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
          case "newConnection":
            if (!(name && url && username && password))
              return vscode.window.showErrorMessage(error.missingParameters);
            if (getConfig(name).name)
              return vscode.window.showErrorMessage(error.connectionExists);
            config.name = name;
            config.workspaces = [];
            configs.unshift(config);
          case "editConnection":
            config.url = url;
            config.username = username;
            config.password = password;
            config.restWorkspaces = restWorkspaces;
            if (isDefaultConnection) await setDefaultConnection(name);
            webview.html = configHTML(config);
            return await setConfigs(configs);
          case "deleteConnection":
            const answer = await vscode.window.showInformationMessage(
              `Do you want to delete the ${name} connection?`,
              ...yesNo
            );
            if (answer !== "Yes") return;
            const connectionCount = configs.length;
            let index = 0;
            for (index; index < connectionCount; index++) {
              if (configs[index].name === name) break;
              if (index + 1 === connectionCount) return;
            }
            configs.splice(index, 1);
            await setConfigs(configs);
            return configWebviewPanel?.dispose();
        }
      },
      undefined,
      subscriptions
    );
  };
