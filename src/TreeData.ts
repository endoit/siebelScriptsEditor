import * as vscode from "vscode";
import {
  siebelObjects,
  NAME,
  NAMESCRIPT,
  DEFINITION,
  WEBTEMP,
  OPEN_FILE,
} from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import axios from "axios";

export class TreeData {
  static readonly checkmarkIcon = new vscode.ThemeIcon("check");
  static timeoutId: NodeJS.Timeout | number | null = null;
  readonly type: SiebelObject;
  readonly objectUrl: string;
  private _folder!: vscode.Uri;
  private _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: (TreeItemObject | TreeItemWebTemp)[] = [];
  dataObject: ScriptObject | OnDiskObject = {};

  static async getDataFromSiebel(
    url: string,
    fields: typeof NAME,
    searchSpec: string
  ): Promise<ScriptResponse[] | WebTempResponse[]>;
  static async getDataFromSiebel(
    url: string,
    fields: typeof NAME | typeof NAMESCRIPT
  ): Promise<ScriptResponse[]>;
  static async getDataFromSiebel(
    url: string,
    fields: typeof DEFINITION
  ): Promise<WebTempResponse[]>;
  static async getDataFromSiebel(
    url: string,
    fields: typeof NAME | typeof NAMESCRIPT | typeof DEFINITION,
    searchSpec?: string
  ) {
    try {
      const params: QueryParams = {
        fields,
      };
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
  }

  static async getFilesOnDisk(directoryUri: vscode.Uri) {
    const fileNames: OnDiskObject = {};
    if (!(await Utils.resourceExists(directoryUri))) return fileNames;
    const content = await vscode.workspace.fs.readDirectory(directoryUri);
    for (const [name, type] of content) {
      if (type !== 1) continue;
      const [fileName, fileExt] = name.split(".");
      if (["js", "ts", "html"].includes(fileExt)) fileNames[fileName] = true;
    }
    return fileNames;
  }

  constructor(type: SiebelObject) {
    this.type = type;
    this.objectUrl = siebelObjects[type].parent;
    vscode.window
      .createTreeView(type, {
        treeDataProvider: this,
        showCollapseAll: type !== WEBTEMP,
      })
      .onDidChangeSelection(async (e) => await this.selectionChange(e as any));
  }

  set folder(workspaceUri: vscode.Uri) {
    this._folder = Utils.joinUri(workspaceUri, this.type);
    this.dataObject = {};
    this.data = [];
    this._onDidChangeTreeData.fire(null);
  }

  get folder() {
    return this._folder;
  }

  getChildren(
    element: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ): (TreeItemObject | TreeItemWebTemp)[] {
    return [];
  }

  getTreeItem(element: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return element;
  }

  createTreeItems(): (TreeItemObject | TreeItemWebTemp)[] {
    return [];
  }

  async createTreeViewData(searchSpec: string) {}

  async selectionChange(
    e: vscode.TreeViewSelectionChangeEvent<
      TreeItemObject | TreeItemScript | TreeItemWebTemp
    >
  ) {}

  async debouncedSearch(searchSpec: string) {
    if (TreeData.timeoutId) clearTimeout(TreeData.timeoutId);
    TreeData.timeoutId = setTimeout(() => {
      this.createTreeViewData(searchSpec);
      TreeData.timeoutId = null;
    }, 300);
  }

  refresh() {
    this.data = this.createTreeItems();
    this._onDidChangeTreeData.fire(null);
  }
}

export class TreeDataScript extends TreeData {
  readonly scriptUrl: string;
  data: TreeItemObject[] = [];
  dataObject: ScriptObject = {};

  constructor(type: NotWebTemp) {
    super(type);
    this.scriptUrl = siebelObjects[type].child;
  }

  getChildren(element: TreeItemObject | TreeItemScript) {
    if (!(element instanceof TreeItemObject)) return this.data;
    const children = [];
    for (const [scriptName, onDisk] of Object.entries(element.scripts)) {
      children.push(new TreeItemScript(scriptName, element.label, onDisk));
    }
    return children;
  }

  createTreeItems() {
    const treeItems = [];
    for (const [name, scripts] of Object.entries(this.dataObject)) {
      treeItems.push(new TreeItemObject(name, scripts));
    }
    return treeItems;
  }

  async createTreeViewData(searchSpec: string) {
    const data = await TreeData.getDataFromSiebel(
      this.objectUrl,
      NAME,
      searchSpec
    );
    this.dataObject = {};
    for (const { Name } of data) {
      const resourceUri = Utils.joinUri(this.folder, Name);
      this.dataObject[Name] = await TreeData.getFilesOnDisk(resourceUri);
    }
    this.refresh();
  }

  async selectionChange({
    selection: [selectedItem],
  }: vscode.TreeViewSelectionChangeEvent<TreeItemObject | TreeItemScript>) {
    if (!selectedItem) return;
    const { label } = selectedItem;
    let answer,
      parent = "",
      methodsOnly = false,
      objectUrlPath = "";
    switch (true) {
      case selectedItem instanceof TreeItemObject:
        parent = label;
        objectUrlPath = Utils.joinUrl(this.objectUrl, label, this.scriptUrl);
        answer =
          Settings.defaultScriptFetching !== "None - always ask"
            ? Settings.defaultScriptFetching
            : await vscode.window.showInformationMessage(
                `Do you want to get the ${label} ${this.objectUrl} from Siebel?`,
                "Yes",
                "Only method names",
                "No"
              );
        methodsOnly = answer === "Only method names";
        break;
      case selectedItem instanceof TreeItemScript:
        ({ parent } = selectedItem);
        objectUrlPath = Utils.joinUrl(
          this.objectUrl,
          parent,
          this.scriptUrl,
          label
        );
        answer = Settings.singleFileAutoDownload
          ? "Yes"
          : await vscode.window.showInformationMessage(
              `Do you want to get the ${label} ${this.objectUrl} method from Siebel?`,
              "Yes",
              "No"
            );
        break;
    }
    if (!(answer === "Yes" || answer === "All scripts" || methodsOnly)) return;
    const folderUri = Utils.joinUri(this.folder, parent),
      fields = methodsOnly ? NAME : NAMESCRIPT,
      data = await TreeData.getDataFromSiebel(objectUrlPath, fields);
    for (const { Name, Script = "" } of data) {
      if (!this.dataObject[parent][Name])
        this.dataObject[parent][Name] = !methodsOnly;
      if (methodsOnly || !Script) continue;
      const fileName = `${Name}${Settings.localFileExtension}`,
        fileUri = Utils.joinUri(folderUri, fileName);
      await Utils.writeFile(fileUri, Script, OPEN_FILE);
    }
    this.refresh();
  }
}

export class TreeDataWebTemp extends TreeData {
  data: TreeItemWebTemp[] = [];
  dataObject: OnDiskObject = {};

  constructor() {
    super(WEBTEMP);
  }

  getChildren(element: TreeItemWebTemp) {
    return this.data;
  }

  createTreeItems() {
    const treeItems = [];
    for (const [name, onDisk] of Object.entries(this.dataObject)) {
      treeItems.push(new TreeItemWebTemp(name, onDisk));
    }
    return treeItems;
  }

  async createTreeViewData(searchSpec: string) {
    const data: WebTempResponse[] = await TreeData.getDataFromSiebel(
      this.objectUrl,
      NAME,
      searchSpec
    );
    this.dataObject = await TreeData.getFilesOnDisk(this.folder);
    for (const { Name } of data) {
      if (this.dataObject[Name]) continue;
      this.dataObject[Name] = false;
    }
    this.refresh();
  }

  async selectionChange({
    selection: [selectedItem],
  }: vscode.TreeViewSelectionChangeEvent<TreeItemWebTemp>) {
    if (!selectedItem) return;
    const { label } = selectedItem,
      answer = Settings.singleFileAutoDownload
        ? "Yes"
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${label} ${this.objectUrl} definition from Siebel?`,
            "Yes",
            "No"
          );
    if (answer !== "Yes") return;
    const objectUrlPath = Utils.joinUrl(this.objectUrl, label),
      data = await TreeData.getDataFromSiebel(objectUrlPath, DEFINITION),
      webtemp = data[0]?.Definition;
    if (webtemp === undefined) return;
    this.dataObject[label] = true;
    const fileName = `${label}.html`,
      filePath = Utils.joinUri(this.folder, fileName);
    await Utils.writeFile(filePath, webtemp, OPEN_FILE);
    this.refresh();
  }
}

class TreeItemObject extends vscode.TreeItem {
  label: string;
  scripts: OnDiskObject;
  constructor(label: string, scripts: OnDiskObject) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = label;
    this.scripts = scripts;
    for (const value of Object.values(scripts)) {
      if (!value) continue;
      this.iconPath = TreeData.checkmarkIcon;
      break;
    }
  }
}

class TreeItemScript extends vscode.TreeItem {
  label: string;
  parent: string;
  constructor(label: string, parent: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.parent = parent;
    if (onDisk) this.iconPath = TreeData.checkmarkIcon;
  }
}

class TreeItemWebTemp extends vscode.TreeItem {
  label: string;
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = TreeData.checkmarkIcon;
  }
}
