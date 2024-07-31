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
  private readonly nameField: NameField;
  private readonly setTreeItems:
    | typeof this.setTreeItemsScript
    | typeof this.setTreeItemsWebTemp;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private _folder!: vscode.Uri;
  private treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];

  constructor(type: SiebelObject) {
    this.type = type;
    this.objectUrl = entity[type].parent;
    this.scriptUrl = entity[type].child;
    [this.setTreeItems, this.nameField] =
      type !== "webtemp"
        ? [this.setTreeItemsScript, "Name,Script"]
        : [this.setTreeItemsWebTemp, "Name,Definition"];
    const treeView = vscode.window.createTreeView(type, {
      treeDataProvider: this,
      showCollapseAll: type !== "webtemp",
    });
    treeView.onDidChangeSelection(async ({ selection: [treeItem] }) => {
      if (treeItem === undefined || treeItem instanceof TreeItemObject) return;
      await this.selectTreeItem(<TreeItemScript | TreeItemWebTemp>treeItem);
    });
    treeView.onDidExpandElement(
      async ({ element }) => await this.selectTreeItem(<TreeItemObject>element)
    );
  }

  set folder(workspaceUri: vscode.Uri) {
    this._folder = vscode.Uri.joinPath(workspaceUri, this.type);
    this.treeItems = [];
    this._onDidChangeTreeData.fire(null);
  }

  get folder() {
    return this._folder;
  }

  getChildren(treeItem: TreeItemObject | TreeItemScript) {
    return treeItem instanceof TreeItemObject
      ? treeItem.children
      : this.treeItems;
  }

  getTreeItem(treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return treeItem;
  }

  async search(searchSpec: string) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(async () => {
      this.treeItems = [];
      const data = await this.getData("names", searchSpec);
      await this.setTreeItems(data);
      this._onDidChangeTreeData.fire(null);
      this.timeoutId = null;
    }, 300);
  }

  private async getData(
    action: DataAction,
    resource: string
  ): Promise<RestResponse[]> {
    try {
      const request: Partial<RequestConfig> = {};
      switch (action) {
        case "names":
          request.params = {
            fields: "Name",
            searchspec: `Name LIKE '${resource}*'`,
          };
          request.url = this.objectUrl;
          break;
        case "scriptNames":
          request.params = { fields: "Name" };
          request.url = [this.objectUrl, resource].join("/");
          break;
        case "download":
          request.params = { fields: this.nameField };
          request.url = [this.objectUrl, resource].join("/");
          break;
      }
      const response = await axios(request);
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
    const files: Set<string> = new Set(),
      directoryUri = vscode.Uri.joinPath(this.folder, parent);
    if (!(await Utils.exists(directoryUri))) return files;
    const content = await vscode.workspace.fs.readDirectory(directoryUri);
    for (const [nameExt, type] of content) {
      if (type !== 1) continue;
      const [name, ext] = nameExt.split(".");
      if (ext === "js" || ext === "ts" || ext === "html") files.add(name);
    }
    return files;
  }

  private async setTreeItemsScript(data: RestResponse[]) {
    for (const { Name } of data) {
      const onDisk = await this.getFilesOnDisk(Name);
      this.treeItems.push(new TreeItemObject(Name, onDisk));
    }
  }

  private async setTreeItemsWebTemp(data: RestResponse[]) {
    const onDisk = await this.getFilesOnDisk();
    for (const { Name } of data) {
      this.treeItems.push(new TreeItemWebTemp(Name, onDisk.has(Name)));
    }
  }

  private async selectTreeItem(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    const { message, path, condition, value, options } = treeItem.question(
        this.objectUrl,
        this.scriptUrl
      ),
      answer = condition
        ? value
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${message} from Siebel?`,
            ...options
          ),
      namesOnly = answer === "Only method names",
      dataAction = namesOnly ? "scriptNames" : "download";
    if (!(answer === "Yes" || answer === "All scripts" || namesOnly)) return;
    const data = await this.getData(dataAction, path);
    await treeItem.select(data, this.folder, !namesOnly);
    this._onDidChangeTreeData.fire(null);
  }
}

class TreeItemObject extends vscode.TreeItem {
  label: string;
  onDisk: Set<string>;
  children: TreeItemScript[] = [];
  constructor(label: string, onDisk: Set<string>) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = label;
    this.onDisk = onDisk;
    if (this.onDisk.size > 0) this.iconPath = checkmarkIcon;
  }

  question(objectUrl: string, scriptUrl: string): TreeItemQuestion {
    return {
      message: `${this.label} ${objectUrl} scripts`,
      path: [this.label, scriptUrl].join("/"),
      condition: Settings.defaultScriptFetching !== "None - always ask",
      value: Settings.defaultScriptFetching,
      options: ["Yes", "Only method names", "No"],
    };
  }

  async select(data: RestResponse[], folder: vscode.Uri, isScript: boolean) {
    this.children = [];
    for (const script of data) {
      const child = new TreeItemScript(script.Name, this.label, this.onDisk);
      this.children.push(child);
      if (!isScript) continue;
      await child.select([script], folder);
      this.iconPath = checkmarkIcon;
    }
    if (isScript) this.iconPath = checkmarkIcon;
  }
}

class TreeItemScript extends vscode.TreeItem {
  label: string;
  parent: string;
  onDisk: Set<string>;

  constructor(label: string, parent: string, onDisk: Set<string>) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.parent = parent;
    this.onDisk = onDisk;
    if (onDisk.has(label)) this.iconPath = checkmarkIcon;
  }

  question(objectUrl: string, scriptUrl: string): TreeItemQuestion {
    return {
      message: `${this.label} script of the ${this.parent} ${objectUrl}`,
      path: [this.parent, scriptUrl, this.label].join("/"),
      condition: Settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
    };
  }

  async select(data: RestResponse[], folder: vscode.Uri) {
    const text = data?.[0]?.Script;
    if (text === undefined) return;
    this.onDisk.add(this.label);
    const fileUri = vscode.Uri.joinPath(
      folder,
      this.parent,
      `${this.label}${Settings.localFileExtension}`
    );
    this.iconPath = checkmarkIcon;
    await Utils.writeFile(fileUri, text, true);
  }
}

class TreeItemWebTemp extends vscode.TreeItem {
  label: string;

  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIcon;
  }

  question(objectUrl: string): TreeItemQuestion {
    return {
      message: `${this.label} ${objectUrl} definition`,
      path: this.label,
      condition: Settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
    };
  }

  async select(data: RestResponse[], folder: vscode.Uri) {
    const text = data?.[0]?.Definition;
    if (text === undefined) return;
    const fileUri = vscode.Uri.joinPath(folder, `${this.label}.html`);
    this.iconPath = checkmarkIcon;
    await Utils.writeFile(fileUri, text, true);
  }
}
