import * as vscode from "vscode";
import { entity } from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import axios from "axios";

const checkmarkIcon = new vscode.ThemeIcon("check");

export class TreeData {
  private readonly type: SiebelObject;
  private readonly objectUrl: string;
  private readonly scriptUrl: string;
  private readonly field: Field;
  private readonly nameField: NameField;
  private readonly isScript: boolean;
  private readonly TreeItem: typeof TreeItemObject | typeof TreeItemWebTemp;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private _folder!: vscode.Uri;
  private dataObject: ScriptObject | OnDiskObject = {};
  private treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];

  constructor(type: SiebelObject) {
    this.type = type;
    this.objectUrl = entity[type].parent;
    this.scriptUrl = entity[type].child;
    this.isScript = type !== "webtemp";
    [this.TreeItem, this.field, this.nameField] = this.isScript
      ? [TreeItemObject, "Script", "Name,Script"]
      : [TreeItemWebTemp, "Definition", "Name,Definition"];
    vscode.window
      .createTreeView(type, {
        treeDataProvider: this,
        showCollapseAll: this.isScript,
      })
      .onDidChangeSelection(async (e) => await this.selectionChange(<any>e));
  }

  set folder(workspaceUri: vscode.Uri) {
    this._folder = vscode.Uri.joinPath(workspaceUri, this.type);
    this.dataObject = {};
    this.treeItems = [];
    this._onDidChangeTreeData.fire(null);
  }

  get folder() {
    return this._folder;
  }

  getChildren(treeItem: TreeItemObject | TreeItemScript) {
    if (!(treeItem instanceof TreeItemObject)) return this.treeItems;
    const children = [];
    for (const [name, onDisk] of Object.entries(treeItem.scripts)) {
      children.push(new TreeItemScript(name, treeItem.label, onDisk));
    }
    return children;
  }

  getTreeItem(treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return treeItem;
  }

  async search(searchSpec: string) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      this.setDataObject(searchSpec);
      this.timeoutId = null;
    }, 300);
  }

  private async getData(
    resource: string,
    namesOnly = true,
    search = true
  ): Promise<RestResponse[]> {
    try {
      const request = {
          params: {
            fields: namesOnly ? "Name" : this.nameField,
            searchspec: search ? `Name LIKE '${resource}*'` : undefined,
          },
          url: search ? this.objectUrl : [this.objectUrl, resource].join("/"),
        },
        response = await axios(request);
      return response?.data?.items || [];
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

  private async getFilesOnDisk(parent = "") {
    const files: OnDiskObject = {},
      directoryUri = vscode.Uri.joinPath(this.folder, parent);
    if (!(await Utils.exists(directoryUri))) return files;
    const content = await vscode.workspace.fs.readDirectory(directoryUri);
    for (const [nameExt, type] of content) {
      if (type !== 1) continue;
      const [name, ext] = nameExt.split(".");
      if (ext === "js" || ext === "ts" || ext === "html") files[name] = true;
    }
    return files;
  }

  private createTreeItems() {
    this.treeItems = [];
    for (const [name, value] of Object.entries(this.dataObject)) {
      this.treeItems.push(new this.TreeItem(name, value));
    }
    this._onDidChangeTreeData.fire(null);
  }

  private async setDataObject(searchSpec: string) {
    const data = await this.getData(searchSpec);
    this.dataObject = {};
    if (this.isScript) {
      for (const { Name } of data) {
        this.dataObject[Name] = await this.getFilesOnDisk(Name);
      }
      return this.createTreeItems();
    }
    const onDiskObject = await this.getFilesOnDisk();
    for (const { Name } of data) {
      this.dataObject[Name] = onDiskObject.hasOwnProperty(Name);
    }
    return this.createTreeItems();
  }

  private async selectionChange({
    selection: [treeItem],
  }: vscode.TreeViewSelectionChangeEvent<
    TreeItemObject | TreeItemScript | TreeItemWebTemp
  >) {
    if (!treeItem) return;
    const { label, parent, message, path, condition, value, options, ext } =
        treeItem.getProperties(this.objectUrl, this.scriptUrl),
      onDiskObject = this.isScript
        ? (<ScriptObject>this.dataObject)[parent]
        : <OnDiskObject>this.dataObject,
      answer = condition
        ? value
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${label} ${message} from Siebel?`,
            ...options
          ),
      namesOnly = answer === "Only method names";
    if (!(answer === "Yes" || answer === "All scripts" || namesOnly)) return;
    const data = await this.getData(path, namesOnly, false);
    for (const { Name, [this.field]: text } of data) {
      if (!onDiskObject[Name]) onDiskObject[Name] = !namesOnly;
      if (namesOnly || text === undefined) continue;
      const fileUri = vscode.Uri.joinPath(this.folder, parent, `${Name}${ext}`);
      await Utils.writeFile(fileUri, text, true);
    }
    return this.createTreeItems();
  }
}

class TreeItemObject extends vscode.TreeItem {
  label: string;
  parent: string;
  scripts: OnDiskObject;
  constructor(label: string, scripts: OnDiskObject) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = label;
    this.parent = label;
    this.scripts = scripts;
    for (const value of Object.values(scripts)) {
      if (!value) continue;
      this.iconPath = checkmarkIcon;
      return;
    }
  }
  getProperties(objectUrl: string, scriptUrl: string): TreeItemProperties {
    return {
      label: this.label,
      parent: this.parent,
      message: `${objectUrl} scripts`,
      path: [this.label, scriptUrl].join("/"),
      condition: Settings.defaultScriptFetching !== "None - always ask",
      value: Settings.defaultScriptFetching,
      options: ["Yes", "Only method names", "No"],
      ext: Settings.localFileExtension,
    };
  }
}

class TreeItemScript extends vscode.TreeItem {
  label: string;
  parent: string;
  constructor(label: string, parent: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.parent = parent;
    if (onDisk) this.iconPath = checkmarkIcon;
  }
  getProperties(objectUrl: string, scriptUrl: string): TreeItemProperties {
    return {
      label: this.label,
      parent: this.parent,
      message: `script of the ${this.parent} ${objectUrl}`,
      path: [this.parent, scriptUrl, this.label].join("/"),
      condition: Settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
      ext: Settings.localFileExtension,
    };
  }
}

class TreeItemWebTemp extends vscode.TreeItem {
  label: string;
  parent = "";
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIcon;
  }
  getProperties(objectUrl: string): TreeItemProperties {
    return {
      label: this.label,
      parent: this.parent,
      message: `${objectUrl} definition`,
      path: this.label,
      condition: Settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
      ext: ".html",
    };
  }
}
