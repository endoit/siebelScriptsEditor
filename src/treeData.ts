import { basename, extname, join } from "path";
import * as vscode from "vscode";
import {
  REPOSITORY_OBJECT,
  CONNECTION,
  WORKSPACE,
  DEFAULT_SCRIPT_FETCHING,
  LOCAL_FILE_EXTENSION,
  SINGLE_FILE_AUTODOWNLOAD,
  NAME,
  NAMESCRIPT,
  SCRIPT,
  DEFINITION,
} from "./constants";
import { getDataFromRESTAPI } from "./dataService";
import { writeFile, writeInfo } from "./fileRW";
import { existsSync, readdirSync } from "fs";
import { GlobalState, joinUrl } from "./utility";

export type TreeItem = TreeItemObject | TreeItemScript | TreeItemWebtemp;

//Icon paths for the checkmark in the tree views
const checkmarkIconPath = {
  light: join(__filename, "..", "..", "media", "checkmark.png"),
  dark: join(__filename, "..", "..", "media", "checkmark.png"),
};

//handle selection in the tree views
export const selectionChange = async (
  { selection: [selectedItem] }: vscode.TreeViewSelectionChangeEvent<TreeItem>,
  treeObject: TreeDataProviderObject | TreeDataProviderWebtemp,
  globalState: GlobalState
) => {
  if (!selectedItem) return;
  const { label } = selectedItem,
    singleFileAutoDownload = globalState.get(SINGLE_FILE_AUTODOWNLOAD);
  if (treeObject instanceof TreeDataProviderObject) {
    if (selectedItem instanceof TreeItemObject) {
      const defaultScriptFetching = globalState.get(DEFAULT_SCRIPT_FETCHING),
        answer =
          defaultScriptFetching !== "None - always ask"
            ? defaultScriptFetching
            : await vscode.window.showInformationMessage(
                `Do you want to get the ${label} ${treeObject.objectUrl} from Siebel?`,
                "Yes",
                "Only method names",
                "No"
              ),
        methodsOnly = answer === "Only method names";
      if (!(answer === "Yes" || answer === "All scripts" || methodsOnly))
        return;
      await treeObject.getAllServerScripts(label, methodsOnly);
      return;
    }
    if (selectedItem instanceof TreeItemScript) {
      const { parent } = selectedItem,
        answer = singleFileAutoDownload
          ? "Yes"
          : await vscode.window.showInformationMessage(
              `Do you want to get the ${label} ${treeObject.objectUrl} method from Siebel?`,
              "Yes",
              "No"
            );
      if (answer !== "Yes") return;
      await treeObject.getServerScript(label, parent);
      return;
    }
  }
  if (
    treeObject instanceof TreeDataProviderWebtemp &&
    selectedItem instanceof TreeItemWebtemp
  ) {
    const answer = singleFileAutoDownload
      ? "Yes"
      : await vscode.window.showInformationMessage(
          `Do you want to get the ${label} ${treeObject.objectUrl} definition from Siebel?`,
          "Yes",
          "No"
        );
    if (answer !== "Yes") return;
    await treeObject.getWebTemplate(label);
    return;
  }
};

//classes for the tree data providers
class TreeDataProviderBase {
  readonly wsFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  readonly type: SiebelObject;
  readonly objectUrl: string;
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: (TreeItemObject | TreeItemWebtemp)[] = [];
  dataObject: ScriptObject | WebTempObject = {};
  globalState: GlobalState;

  constructor(globalState: GlobalState, type: SiebelObject) {
    this.globalState = globalState;
    this.type = type;
    this.objectUrl = REPOSITORY_OBJECT[type].parent;
  }

  get folder() {
    return join(
      this.wsFolder,
      this.globalState.get(CONNECTION),
      this.globalState.get(WORKSPACE),
      this.type
    );
  }

  getTreeItem = (element: TreeItem) => element;

  createTreeItems = (): (TreeItemObject | TreeItemWebtemp)[] => [];

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
  data: TreeItemObject[] = [];
  dataObject: ScriptObject = {};
  readonly type: ObjectWithScript;
  readonly scriptUrl: string;

  constructor(globalState: GlobalState, type: ObjectWithScript) {
    super(globalState, type);
    this.type = type;
    this.scriptUrl = REPOSITORY_OBJECT[type].child;
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
    const data = await getDataFromRESTAPI(this.objectUrl, NAME, searchSpec);
    this.dataObject = {};
    for (const { Name } of data) {
      const exists = existsSync(join(this.folder, Name));
      this.dataObject[Name] = {};
      if (!exists) continue;
      const fileNames = readdirSync(join(this.folder, Name));
      for (let file of fileNames) {
        this.dataObject[Name][basename(file, extname(file))] = true;
      }
    }
    this.refresh();
  };

  getAllServerScripts = async (objectName: string, namesOnly = false) => {
    const folderPath = join(this.folder, objectName),
      objectUrlPath = joinUrl(this.objectUrl, objectName, this.scriptUrl),
      data: ScriptResponse[] = await getDataFromRESTAPI(
        objectUrlPath,
        namesOnly ? NAME : NAMESCRIPT
      ),
      OPEN_FILE = true,
      scriptNames = [],
      localFileExtension = this.globalState.get(LOCAL_FILE_EXTENSION);
    for (const { Name, Script } of data) {
      const fileNameNoExt = join(folderPath, Name);
      scriptNames.push(Name);
      this.dataObject[objectName][Name] = namesOnly
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
      data: ScriptResponse[] = await getDataFromRESTAPI(objectUrlPath, SCRIPT),
      script = data[0]?.Script,
      localFileExtension = this.globalState.get(LOCAL_FILE_EXTENSION),
      OPEN_FILE = true;
    if (!script) return;
    this.dataObject[parentName][objectName] = true;
    const filePath = join(folderPath, `${objectName}${localFileExtension}`);
    await writeFile(filePath, script, OPEN_FILE);
    await writeInfo(folderPath, [objectName], this.globalState);
    this.refresh();
  };
}

export class TreeDataProviderWebtemp extends TreeDataProviderBase {
  data: TreeItemWebtemp[] = [];
  dataObject: WebTempObject = {};
  readonly type: ObjectWithDefinition;

  constructor(globalState: GlobalState, type: ObjectWithDefinition) {
    super(globalState, type);
    this.type = type;
  }

  getChildren = (element: TreeItem) => this.data;

  createTreeItems = () =>
    Object.entries(this.dataObject).map(
      ([name, onDisk]) => new TreeItemWebtemp(name, onDisk)
    );

  createTreeViewData = async (searchSpec: string) => {
    const data = await getDataFromRESTAPI(this.objectUrl, NAME, searchSpec);
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
      data: WebTempResponse[] = await getDataFromRESTAPI(
        objectUrlPath,
        DEFINITION
      ),
      webtemp = data[0]?.Definition,
      OPEN_FILE = true;
    if (webtemp === undefined) return;
    this.dataObject[objectName] = true;
    const filePath = join(this.folder, `${objectName}.html`);
    await writeFile(filePath, webtemp, OPEN_FILE);
    await writeInfo(this.folder, [objectName], this.globalState);
    this.refresh();
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

class TreeItemWebtemp extends vscode.TreeItem {
  label: string;
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIconPath;
  }
}
