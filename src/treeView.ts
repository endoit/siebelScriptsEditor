import { basename, extname, join } from "path";
import * as vscode from "vscode";
import {
  repositoryObjects,
  WORKSPACE,
  DEFAULT_SCRIPT_FETCHING,
  LOCAL_FILE_EXTENSION,
  SINGLE_FILE_AUTODOWNLOAD,
  NAME,
  NAMESCRIPT,
  SCRIPT,
  DEFINITION,
  WEBTEMP,
  OPEN_FILE,
  BUSCOMP,
  SERVICE,
  APPLET,
  APPLICATION,
  GET,
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  ERR_NO_CONN_SETTING,
  MAX_PAGE_SIZE,
  CONNECTION,
  SEARCH,
  TYPE,
  NEW_OR_EDIT_CONNECTION,
  ADD,
  DEFAULT,
  DELETE,
  DELETE_CONNECTION,
  ERR_CONN_MISSING_PARAMS,
  REST_WORKSPACES,
  TEST_CONNECTION,
  TEST_REST_WORKSPACES,
  CHILD_LINKS,
  UNIFORM_RESPONSE,
} from "./constants";
import { existsSync, readdirSync } from "fs";
import {
  callSiebelREST,
  getConnection,
  getSetting,
  joinUrl,
  setSetting,
  writeFile,
} from "./utility";
import axios from "axios";
import { configHTML, dataSourceHTML } from "./webView";

const getDataFromSiebel: IGetDataFromSiebel = async (
    url,
    fields,
    searchSpec?: string
  ) => {
    try {
      const params: QueryParams = { fields };
      params.PageSize = getSetting(MAX_PAGE_SIZE);
      if (searchSpec) params.searchspec = `Name LIKE '${searchSpec}*'`;
      const response = await axios({ url, params });
      return response.data?.items;
    } catch (err: any) {
      if (err.response?.status !== 404) {
        vscode.window.showErrorMessage(
          `Error using the Siebel REST API: ${
            err.response?.data?.ERROR || err.message
          }`
        );
      }
      return [];
    }
  },
  checkmarkIconPath = {
    light: join(__filename, "..", "..", "media", "checkmark_light.png"),
    dark: join(__filename, "..", "..", "media", "checkmark_dark.png"),
  } as const;

export class TreeViews {
  private static _instance: TreeViews;
  private readonly workspaceFolder =
    vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  private readonly treeDataProviders = {
    [SERVICE]: new TreeDataProviderObject(SERVICE),
    [BUSCOMP]: new TreeDataProviderObject(BUSCOMP),
    [APPLET]: new TreeDataProviderObject(APPLET),
    [APPLICATION]: new TreeDataProviderObject(APPLICATION),
    [WEBTEMP]: new TreeDataProviderWebTemp(),
  } as const;
  private configWebviewPanel: vscode.WebviewPanel | undefined;
  private connection = "";
  private connections: string[] = [];
  private _workspace = "";
  private workspaces: string[] = [];
  private interceptor = 0;
  private type: SiebelObject = SERVICE;

  constructor() {
    if (TreeViews._instance) return TreeViews._instance;
    TreeViews._instance = this;
    for (const [type, treeDataProvider] of Object.entries(
      this.treeDataProviders
    )) {
      vscode.window
        .createTreeView(type, {
          treeDataProvider,
          showCollapseAll: type !== WEBTEMP,
        })
        .onDidChangeSelection(async (e) =>
          treeDataProvider.selectionChange(e as any)
        );
    }
  }

  private set workspace(newWorkspace: string) {
    this._workspace = newWorkspace;
    const { url, username, password } = getConnection(this.connection);
    axios.interceptors.request.eject(this.interceptor);
    this.interceptor = axios.interceptors.request.use((config) => {
      config.headers["Content-Type"] = "application/json";
      return {
        ...config,
        baseURL: joinUrl(url, WORKSPACE, this.workspace),
        method: GET,
        withCredentials: true,
        auth: { username, password },
        params: {
          uniformresponse: UNIFORM_RESPONSE,
          childlinks: CHILD_LINKS,
          ...config.params,
        },
      };
    });
    for (const treeDataProvider of Object.values(this.treeDataProviders)) {
      treeDataProvider.folder = join(
        this.workspaceFolder,
        this.connection,
        this.workspace
      );
      treeDataProvider.clear();
    }
  }

  private get workspace() {
    return this._workspace;
  }

  private async adjustConnection(
    newConnection?: string
  ): Promise<TreeViewsState> {
    this.connections = getSetting(CONNECTIONS).map(({ name }) => name);
    if (this.connections.length === 0) {
      vscode.window.showErrorMessage(ERR_NO_CONN_SETTING);
      return {};
    }
    const defaultConnectionName = getSetting(DEFAULT_CONNECTION_NAME);
    this.connection = newConnection
      ? newConnection
      : this.connections.includes(this.connection)
      ? this.connection
      : this.connections.includes(defaultConnectionName)
      ? defaultConnectionName
      : getSetting(CONNECTIONS)[0].name;
    const {
      url,
      username,
      password,
      workspaces,
      defaultWorkspace,
      restWorkspaces,
    } = getConnection(this.connection);
    this.workspaces = restWorkspaces
      ? await callSiebelREST(REST_WORKSPACES, url, username, password)
      : workspaces;
    this.workspace = this.workspaces.includes(this.workspace)
      ? this.workspace
      : restWorkspaces || !workspaces.includes(defaultWorkspace)
      ? this.workspaces[0] || ""
      : defaultWorkspace;
    return {
      connections: this.connections,
      selectedConnection: this.connection,
      workspaces: this.workspaces,
      selectedWorkspace: this.workspace,
      type: this.type,
    };
  }

  dataSourceWebview(context: vscode.ExtensionContext) {
    return async ({ webview }: { webview: vscode.Webview }) => {
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("siebelScriptAndWebTempEditor.connections"))
          return webview.postMessage(await this.adjustConnection());
      });
      webview.options = { enableScripts: true };
      webview.onDidReceiveMessage(
        async ({ command, data }: DataSourceMessage) => {
          switch (command) {
            case CONNECTION:
              return webview.postMessage(await this.adjustConnection(data));
            case WORKSPACE:
              return (this.workspace = data);
            case TYPE:
              return (this.type = data as SiebelObject);
            case SEARCH:
              return await this.treeDataProviders[this.type].debouncedSearch(
                data
              );
          }
        },
        undefined,
        context.subscriptions
      );
      webview.html = dataSourceHTML;
      webview.postMessage(await this.adjustConnection());
    };
  }

  configWebview(context: vscode.ExtensionContext, isNewConnection = false) {
    return async () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
      if (!isNewConnection)
        isNewConnection = getSetting(CONNECTIONS).length === 0;

      if (this.configWebviewPanel) {
        this.configWebviewPanel.webview.html = configHTML(
          this.connection,
          isNewConnection
        );
        return this.configWebviewPanel.reveal(columnToShowIn);
      }
      this.configWebviewPanel = vscode.window.createWebviewPanel(
        "configureConnection",
        "Configure Connection",
        columnToShowIn || vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.configWebviewPanel.webview.html = configHTML(
        this.connection,
        isNewConnection
      );
      this.configWebviewPanel.onDidDispose(
        () => (this.configWebviewPanel = undefined),
        null,
        context.subscriptions
      );
      this.configWebviewPanel.webview.onDidReceiveMessage(
        async ({
          command,
          action,
          workspace,
          connectionName,
          url,
          username,
          password,
          restWorkspaces,
          defaultConnection,
        }: ConfigMessage) => {
          const connections = getSetting(CONNECTIONS),
            connection = getConnection(connectionName);
          switch (command) {
            case WORKSPACE:
              const { workspaces } = connection;
              switch (action) {
                case ADD:
                  if (workspaces.includes(workspace)) return;
                  workspaces.unshift(workspace);
                  if (workspaces.length === 1)
                    connection.defaultWorkspace = workspace;
                  break;
                case DEFAULT:
                  connection.defaultWorkspace = workspace;
                  break;
                case DELETE:
                  workspaces.splice(workspaces.indexOf(workspace), 1);
                  if (connection.defaultWorkspace === workspace)
                    connection.defaultWorkspace = workspaces[0] ?? "";
                  break;
              }
              await setSetting(CONNECTIONS, connections);
              return (this.configWebviewPanel!.webview.html =
                configHTML(connectionName));
            case TEST_REST_WORKSPACES:
              return await callSiebelREST(
                TEST_REST_WORKSPACES,
                url,
                username,
                password
              );
            case TEST_CONNECTION:
              return await callSiebelREST(
                TEST_CONNECTION,
                url,
                username,
                password
              );
            case NEW_OR_EDIT_CONNECTION:
              if (!(connectionName && url && username && password))
                return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
              if (connection.name) {
                connection.url = url;
                connection.username = username;
                connection.password = password;
                connection.restWorkspaces = restWorkspaces;
                await setSetting(CONNECTIONS, connections);
                if (defaultConnection)
                  await setSetting(DEFAULT_CONNECTION_NAME, connectionName);
                return this.configWebviewPanel?.dispose();
              }
              connections.unshift({
                name: connectionName,
                url,
                username,
                password,
                restWorkspaces,
                workspaces: [],
                defaultWorkspace: "",
              });
              await setSetting(CONNECTIONS, connections);
              return (this.configWebviewPanel!.webview.html =
                configHTML(connectionName));
            case DELETE_CONNECTION:
              const answer = await vscode.window.showInformationMessage(
                `Do you want to delete connection ${connectionName}?`,
                "Yes",
                "No"
              );
              if (answer !== "Yes") return;
              await setSetting(
                CONNECTIONS,
                connections.filter(({ name }) => name !== connectionName)
              );
              return this.configWebviewPanel?.dispose();
          }
        },
        undefined,
        context.subscriptions
      );
    };
  }
}

class TreeDataProviderBase {
  readonly type: SiebelObject;
  readonly objectUrl: string;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private _folder = "";
  private _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: (TreeItemObject | TreeItemWebTemp)[] = [];
  dataObject: ScriptObject | WebTempObject = {};

  constructor(type: SiebelObject) {
    this.type = type;
    this.objectUrl = repositoryObjects[type].parent;
  }

  set folder(siebelWorkspaceFolder: string) {
    this._folder = join(siebelWorkspaceFolder, this.type);
  }

  get folder() {
    return this._folder;
  }

  getTreeItem(element: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return element;
  }

  createTreeItems(): (TreeItemObject | TreeItemWebTemp)[] {
    return [];
  }

  async createTreeViewData(searchSpec: string) {}

  async debouncedSearch(searchSpec: string) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.createTreeViewData(searchSpec);
      this.timeoutId = null;
    }, 300);
  }

  refresh() {
    this.data = this.createTreeItems();
    this._onDidChangeTreeData.fire(null);
  }

  clear() {
    this.dataObject = {};
    this.data = [];
    this._onDidChangeTreeData.fire(null);
  }
}

export class TreeDataProviderObject extends TreeDataProviderBase {
  readonly scriptUrl: string;
  data: TreeItemObject[] = [];
  dataObject: ScriptObject = {};

  constructor(type: NotWebTemp) {
    super(type);
    this.scriptUrl = repositoryObjects[type].child;
  }

  getChildren(element: TreeItemObject | TreeItemScript) {
    return element instanceof TreeItemObject
      ? Object.entries(element.scripts).map(
          ([scriptName, onDisk]) =>
            new TreeItemScript(scriptName, element.label, onDisk)
        )
      : this.data;
  }

  createTreeItems() {
    return Object.entries(this.dataObject).map(
      ([name, scripts]) => new TreeItemObject(name, scripts)
    );
  }

  async createTreeViewData(searchSpec: string) {
    const data: ScriptResponse[] = await getDataFromSiebel(
      this.objectUrl,
      NAME,
      searchSpec
    );
    this.dataObject = {};
    for (const { Name } of data) {
      this.dataObject[Name] = {};
      if (!existsSync(join(this.folder, Name))) continue;
      const fileNames = readdirSync(join(this.folder, Name));
      for (const file of fileNames) {
        if (file.endsWith(".js") || file.endsWith(".ts"))
          this.dataObject[Name][basename(file, extname(file))] = true;
      }
    }
    this.refresh();
  }

  async getAllServerScripts(parentName: string, namesOnly = false) {
    const folderPath = join(this.folder, parentName),
      objectUrlPath = joinUrl(this.objectUrl, parentName, this.scriptUrl),
      data = await getDataFromSiebel(
        objectUrlPath,
        namesOnly ? NAME : NAMESCRIPT
      ),
      localFileExtension = getSetting(LOCAL_FILE_EXTENSION);
    for (const { Name, Script } of data) {
      const fileNameNoExt = join(folderPath, Name);
      this.dataObject[parentName][Name] = namesOnly
        ? existsSync(`${fileNameNoExt}.js`) || existsSync(`${fileNameNoExt}.ts`)
        : true;
      if (namesOnly || !Script) continue;
      const filePath = join(folderPath, `${Name}${localFileExtension}`);
      await writeFile(filePath, Script, OPEN_FILE);
    }
    this.refresh();
  }

  async getServerScript(objectName: string, parentName: string) {
    const folderPath = join(this.folder, parentName),
      objectUrlPath = joinUrl(
        this.objectUrl,
        parentName,
        this.scriptUrl,
        objectName
      ),
      data = await getDataFromSiebel(objectUrlPath, SCRIPT),
      script = data[0]?.Script,
      localFileExtension = getSetting(LOCAL_FILE_EXTENSION);
    if (!script) return;
    this.dataObject[parentName][objectName] = true;
    const filePath = join(folderPath, `${objectName}${localFileExtension}`);
    await writeFile(filePath, script, OPEN_FILE);
    this.refresh();
  }

  async selectionChange({
    selection: [selectedItem],
  }: vscode.TreeViewSelectionChangeEvent<TreeItemObject | TreeItemScript>) {
    if (!selectedItem) return;
    const { label } = selectedItem,
      singleFileAutoDownload = getSetting(SINGLE_FILE_AUTODOWNLOAD);
    let answer;
    switch (true) {
      case selectedItem instanceof TreeItemObject:
        const defaultScriptFetching = getSetting(DEFAULT_SCRIPT_FETCHING);
        answer =
          defaultScriptFetching !== "None - always ask"
            ? defaultScriptFetching
            : await vscode.window.showInformationMessage(
                `Do you want to get the ${label} ${this.objectUrl} from Siebel?`,
                "Yes",
                "Only method names",
                "No"
              );
        const methodsOnly = answer === "Only method names";
        if (!(answer === "Yes" || answer === "All scripts" || methodsOnly))
          return;
        return await this.getAllServerScripts(label, methodsOnly);
      case selectedItem instanceof TreeItemScript:
        const { parent } = selectedItem;
        answer = singleFileAutoDownload
          ? "Yes"
          : await vscode.window.showInformationMessage(
              `Do you want to get the ${label} ${this.objectUrl} method from Siebel?`,
              "Yes",
              "No"
            );
        if (answer !== "Yes") return;
        return await this.getServerScript(label, parent);
    }
  }
}

export class TreeDataProviderWebTemp extends TreeDataProviderBase {
  data: TreeItemWebTemp[] = [];
  dataObject: WebTempObject = {};

  constructor() {
    super(WEBTEMP);
  }

  getChildren(element: TreeItemWebTemp) {
    return this.data;
  }

  createTreeItems() {
    return Object.entries(this.dataObject).map(
      ([name, onDisk]) => new TreeItemWebTemp(name, onDisk)
    );
  }

  async createTreeViewData(searchSpec: string) {
    const data: WebTempResponse[] = await getDataFromSiebel(
      this.objectUrl,
      NAME,
      searchSpec
    );
    this.dataObject = {};
    for (const { Name } of data) {
      this.dataObject[Name] = existsSync(join(this.folder, `${Name}.html`));
    }
    this.refresh();
  }

  async getWebTemplate(objectName: string) {
    const objectUrlPath = joinUrl(this.objectUrl, objectName),
      data = await getDataFromSiebel(objectUrlPath, DEFINITION),
      webtemp = data[0]?.Definition;
    if (webtemp === undefined) return;
    this.dataObject[objectName] = true;
    const filePath = join(this.folder, `${objectName}.html`);
    await writeFile(filePath, webtemp, OPEN_FILE);
    this.refresh();
  }

  async selectionChange({
    selection: [selectedItem],
  }: vscode.TreeViewSelectionChangeEvent<TreeItemWebTemp>) {
    if (!selectedItem) return;
    const { label } = selectedItem,
      singleFileAutoDownload = getSetting(SINGLE_FILE_AUTODOWNLOAD);
    const answer = singleFileAutoDownload
      ? "Yes"
      : await vscode.window.showInformationMessage(
          `Do you want to get the ${label} ${this.objectUrl} definition from Siebel?`,
          "Yes",
          "No"
        );
    if (answer !== "Yes") return;
    return await this.getWebTemplate(label);
  }
}

class TreeItemObject extends vscode.TreeItem {
  label: string;
  scripts: Scripts;
  constructor(label: string, scripts: Scripts) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = label;
    this.scripts = scripts;
    if (Object.values(scripts).some((onDisk) => onDisk))
      this.iconPath = checkmarkIconPath;
  }
}

class TreeItemScript extends vscode.TreeItem {
  label: string;
  parent: string;
  constructor(label: string, parent: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.parent = parent;
    if (onDisk) this.iconPath = checkmarkIconPath;
  }
}

class TreeItemWebTemp extends vscode.TreeItem {
  label: string;
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIconPath;
  }
}
