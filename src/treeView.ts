import { basename, extname, join } from "path";
import * as vscode from "vscode";
import {
  repositoryObjects,
  CONNECTION,
  WORKSPACE,
  DEFAULT_SCRIPT_FETCHING,
  LOCAL_FILE_EXTENSION,
  SINGLE_FILE_AUTODOWNLOAD,
  NAME,
  NAMESCRIPT,
  SCRIPT,
  DEFINITION,
  WEBTEMP,
  WORKSPACE_FOLDER,
  FILE_NAME_INFO,
  OPEN_FILE,
} from "./constants";
import { getDataFromSiebel } from "./dataService";
import { writeFile, writeInfo } from "./fileRW";
import { existsSync, readdirSync } from "fs";
import { GlobalState, getSetting, joinUrl } from "./utility";

type TreeItem = TreeItemObject | TreeItemScript | TreeItemWebTemp;

//Icon paths for the checkmark in the tree views
const checkmarkIconPath = {
  light: join(__filename, "..", "..", "media", "checkmark.png"),
  dark: join(__filename, "..", "..", "media", "checkmark.png"),
} as const;

//classes for the tree data providers
class TreeDataProviderBase {
  readonly type: SiebelObject;
  readonly globalState: GlobalState;
  readonly objectUrl: string;
  readonly workspaceFolder: string;
  private timeoutId: NodeJS.Timeout | number | null = null;
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: (TreeItemObject | TreeItemWebTemp)[] = [];
  dataObject: ScriptObject | WebTempObject = {};

  constructor(type: SiebelObject, globalState: GlobalState) {
    this.globalState = globalState;
    this.type = type;
    this.objectUrl = repositoryObjects[type].parent;
    this.workspaceFolder = globalState.get(WORKSPACE_FOLDER);
  }

  get folder() {
    return join(
      this.workspaceFolder,
      this.globalState.get(CONNECTION),
      this.globalState.get(WORKSPACE),
      this.type
    );
  }

  getTreeItem = (element: TreeItem) => element;

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

  constructor(type: NotWebTemp, globalState: GlobalState) {
    super(type, globalState);
    this.type = type;
    this.scriptUrl = repositoryObjects[type].child;
  }

  getChildren = (element: TreeItem) =>
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
      const exists = existsSync(join(this.folder, Name));
      this.dataObject[Name] = {};
      if (!exists) continue;
      const fileNames = readdirSync(join(this.folder, Name));
      for (let file of fileNames) {
        if (file !== FILE_NAME_INFO)
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
      scriptNames = [],
      localFileExtension = getSetting(LOCAL_FILE_EXTENSION);
    for (const { Name, Script } of data) {
      const fileNameNoExt = join(folderPath, Name);
      scriptNames.push(Name);
      this.dataObject[parentName][Name] = namesOnly
        ? existsSync(`${fileNameNoExt}.js`) || existsSync(`${fileNameNoExt}.ts`)
        : true;
      if (namesOnly || !Script) continue;
      const filePath = join(folderPath, `${Name}${localFileExtension}`);
      await writeFile(filePath, Script, OPEN_FILE);
    }
    if (!namesOnly) await writeInfo(folderPath, scriptNames, this.globalState);
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
    await writeInfo(folderPath, [objectName], this.globalState);
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
  readonly type;
  data: TreeItemWebTemp[] = [];
  dataObject: WebTempObject = {};

  constructor(type: typeof WEBTEMP, globalState: GlobalState) {
    super(type, globalState);
    this.type = type;
  }

  getChildren = (element: TreeItem) => this.data;

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
    for (let row of data) {
      this.dataObject[row.Name] = existsSync(
        join(this.folder, `${row.Name}.html`)
      );
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
    await writeInfo(this.folder, [objectName], this.globalState);
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
    if (Object.values(scripts).some((x) => x))
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
