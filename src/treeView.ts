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
  siebelObjects,
  GET,
  baseQueryParams,
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  ERR_NO_CONN_SETTING,
  MAX_PAGE_SIZE,
} from "./constants";
import { getWorkspaces } from "./dataService";
import { existsSync, readdirSync } from "fs";
import { getConnection, getSetting, joinUrl, writeFile } from "./utility";
import axios from "axios";

const checkmarkIconPath = {
  light: join(__filename, "..", "..", "media", "checkmark.png"),
  dark: join(__filename, "..", "..", "media", "checkmark.png"),
} as const;

const getDataFromSiebel: IGetDataFromSiebel = async (
  url: string,
  fields: QueryParams["fields"],
  searchSpec?: string
): Promise<ScriptResponse[] | WebTempResponse[]> => {
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
};

export class TreeViews {
  private readonly workspaceFolder =
    vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  private readonly service = new TreeDataProviderObject(SERVICE);
  private readonly buscomp = new TreeDataProviderObject(BUSCOMP);
  private readonly applet = new TreeDataProviderObject(APPLET);
  private readonly application = new TreeDataProviderObject(APPLICATION);
  private readonly webtemp = new TreeDataProviderWebTemp();
  private readonly treeDataProviders: (
    | TreeDataProviderObject
    | TreeDataProviderWebTemp
  )[] = [];
  private interceptor = 0;
  private _workspace = "";
  private workspaces: string[] = [];
  connection = "";
  type: SiebelObject = SERVICE;

  constructor() {
    for (const type of siebelObjects) {
      this.createTreeView(type);
      this.treeDataProviders.push(this[type]);
    }
  }

  private createTreeView = (type: SiebelObject) =>
    vscode.window
      .createTreeView(type, {
        treeDataProvider: this[type],
        showCollapseAll: type !== WEBTEMP,
      })
      .onDidChangeSelection(async (e) => this[type].selectionChange(e as any));

  get connections() {
    return getSetting(CONNECTIONS).map(({ name }) => name);
  }

  set workspace(newWorkspace: string) {
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
          ...config.params,
          ...baseQueryParams,
        },
      };
    });
    for (const treeDataProvider of this.treeDataProviders) {
      treeDataProvider.folder = this.folder;
      treeDataProvider.clear();
    }
  }

  get workspace() {
    return this._workspace;
  }

  get folder() {
    return join(
      this.workspaceFolder,
      this.connection || "",
      this.workspace || ""
    );
  }

  setAndGet = async () => {
    if (this.connections.length === 0) {
      vscode.window.showErrorMessage(ERR_NO_CONN_SETTING);
      return {};
    }
    const defaultConnectionName = getSetting(DEFAULT_CONNECTION_NAME);
    this.connection = this.connections.includes(this.connection)
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
      ? await getWorkspaces(url, username, password)
      : workspaces;
    this.workspace = this.workspaces.includes(this.workspace)
      ? this.workspace
      : restWorkspaces || !workspaces.includes(defaultWorkspace)
      ? this.workspaces[0]
      : defaultWorkspace;
    return {
      connections: this.connections,
      selectedConnection: this.connection,
      workspaces: this.workspaces,
      selectedWorkspace: this.workspace,
    };
  };

  search = async (searchString: string) =>
    await this[this.type].debouncedSearch(searchString);
}

class TreeDataProviderBase {
  readonly type: SiebelObject;
  readonly objectUrl: string;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private _folder = "";
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: (TreeItemObject | TreeItemWebTemp)[] = [];
  dataObject: ScriptObject | WebTempObject = {};

  constructor(type: SiebelObject) {
    this.type = type;
    this.objectUrl = repositoryObjects[type].parent;
    this.folder = "";
  }

  set folder(siebelWorkspaceFolder: string) {
    this._folder = join(siebelWorkspaceFolder, this.type);
  }

  get folder() {
    return this._folder;
  }

  getTreeItem = (element: TreeItemObject | TreeItemScript | TreeItemWebTemp) =>
    element;

  createTreeItems = (): (TreeItemObject | TreeItemWebTemp)[] => [];

  createTreeViewData = async (searchSpec: string) => {};

  debounce = async (callback: () => void) => {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      callback();
      this.timeoutId = null;
    }, 300);
  };

  debouncedSearch = async (searchSpec: string) =>
    await this.debounce(() => this.createTreeViewData(searchSpec));

  refresh = () => {
    this.data = this.createTreeItems();
    this._onDidChangeTreeData.fire(null);
  };

  clear = () => {
    this.dataObject = {};
    this.data = [];
    this._onDidChangeTreeData.fire(null);
  };
}

export class TreeDataProviderObject extends TreeDataProviderBase {
  readonly type;
  readonly scriptUrl: string;
  data: TreeItemObject[] = [];
  dataObject: ScriptObject = {};

  constructor(type: NotWebTemp) {
    super(type);
    this.type = type;
    this.scriptUrl = repositoryObjects[type].child;
  }

  getChildren = (element: TreeItemObject | TreeItemScript) =>
    element instanceof TreeItemObject
      ? Object.entries(element.scripts).map(
          ([scriptName, onDisk]) =>
            new TreeItemScript(scriptName, element.label, onDisk)
        )
      : this.data;

  createTreeItems = () =>
    Object.entries(this.dataObject).map(
      ([name, scripts]) => new TreeItemObject(name, scripts)
    );

  createTreeViewData = async (searchSpec: string) => {
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
  };

  getAllServerScripts = async (parentName: string, namesOnly = false) => {
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
  };

  getServerScript = async (objectName: string, parentName: string) => {
    const folderPath = join(this.folder, parentName),
      objectUrlPath = joinUrl(
        this.objectUrl,
        parentName,
        this.scriptUrl,
        objectName
      ),
      data = await getDataFromSiebel(objectUrlPath, SCRIPT),
      script = data[0]?.Script,
      localFileExtension = getSetting(LOCAL_FILE_EXTENSION),
      OPEN_FILE = true;
    if (!script) return;
    this.dataObject[parentName][objectName] = true;
    const filePath = join(folderPath, `${objectName}${localFileExtension}`);
    await writeFile(filePath, script, OPEN_FILE);
    this.refresh();
  };

  selectionChange = async ({
    selection: [selectedItem],
  }: vscode.TreeViewSelectionChangeEvent<TreeItemObject | TreeItemScript>) => {
    if (!selectedItem) return;
    const { label } = selectedItem,
      singleFileAutoDownload = getSetting(SINGLE_FILE_AUTODOWNLOAD);
    if (selectedItem instanceof TreeItemObject) {
      const defaultScriptFetching = getSetting(DEFAULT_SCRIPT_FETCHING),
        answer =
          defaultScriptFetching !== "None - always ask"
            ? defaultScriptFetching
            : await vscode.window.showInformationMessage(
                `Do you want to get the ${label} ${this.objectUrl} from Siebel?`,
                "Yes",
                "Only method names",
                "No"
              ),
        methodsOnly = answer === "Only method names";
      if (!(answer === "Yes" || answer === "All scripts" || methodsOnly))
        return;
      return await this.getAllServerScripts(label, methodsOnly);
    }
    if (selectedItem instanceof TreeItemScript) {
      const { parent } = selectedItem,
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
  };
}

export class TreeDataProviderWebTemp extends TreeDataProviderBase {
  data: TreeItemWebTemp[] = [];
  dataObject: WebTempObject = {};

  constructor() {
    super(WEBTEMP);
  }

  getChildren = (element: TreeItemWebTemp) => this.data;

  createTreeItems = () =>
    Object.entries(this.dataObject).map(
      ([name, onDisk]) => new TreeItemWebTemp(name, onDisk)
    );

  createTreeViewData = async (searchSpec: string) => {
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
  };

  getWebTemplate = async (objectName: string) => {
    const objectUrlPath = joinUrl(this.objectUrl, objectName),
      data = await getDataFromSiebel(objectUrlPath, DEFINITION),
      webtemp = data[0]?.Definition,
      OPEN_FILE = true;
    if (webtemp === undefined) return;
    this.dataObject[objectName] = true;
    const filePath = join(this.folder, `${objectName}.html`);
    await writeFile(filePath, webtemp, OPEN_FILE);
    this.refresh();
  };

  selectionChange = async ({
    selection: [selectedItem],
  }: vscode.TreeViewSelectionChangeEvent<TreeItemWebTemp>) => {
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
  };
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
