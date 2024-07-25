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
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private _folder!: vscode.Uri;
  private treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];

  constructor(type: SiebelObject) {
    this.type = type;
    this.objectUrl = entity[type].parent;
    this.scriptUrl = entity[type].child;
    this.isScript = type !== "webtemp";
    this.field = this.isScript ? "Script" : "Definition";
    this.nameField = this.isScript ? "Name,Script" : "Name,Definition";
    const treeView = vscode.window.createTreeView(type, {
      treeDataProvider: this,
      showCollapseAll: this.isScript,
    });
    treeView.onDidChangeSelection(
      async ({ selection: [treeItem] }) =>
        await this.selectionChange(<TreeItemScript | TreeItemWebTemp>treeItem)
    );
    if (this.isScript) {
      treeView.onDidExpandElement(
        async ({ element }) =>
          await this.selectionChange(<TreeItemObject>element)
      );
    }
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
    if (!(treeItem instanceof TreeItemObject)) return this.treeItems;
    return treeItem.children;
  }

  getTreeItem(treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return treeItem;
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

  async search(searchSpec: string) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(async () => {
      const data = await this.getData(searchSpec);
      this.treeItems = [];
      if (this.isScript) {
        for (const { Name } of data) {
          const onDisk = await this.getFilesOnDisk(Name);
          this.treeItems.push(new TreeItemObject(Name, onDisk));
        }
      } else {
        const onDisk = await this.getFilesOnDisk();
        for (const { Name } of data) {
          this.treeItems.push(new TreeItemWebTemp(Name, onDisk.has(Name)));
        }
      }
      this._onDidChangeTreeData.fire(null);
      this.timeoutId = null;
    }, 300);
  }

  private async selectionChange(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    if (treeItem instanceof TreeItemObject || treeItem === undefined) return;
    const { message, path, condition, value, options } = treeItem.getProperties(
        this.objectUrl,
        this.scriptUrl
      ),
      answer = condition
        ? value
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${message} from Siebel?`,
            ...options
          ),
      namesOnly = answer === "Only method names";
    if (!(answer === "Yes" || answer === "All scripts" || namesOnly)) return;
    const data = await this.getData(path, namesOnly, false);
    if (treeItem instanceof TreeItemObject) {
      await treeItem.download(data, this.folder, !namesOnly);
    } else {
      const { Name, [this.field]: text } = data?.[0] || {};
      if (text === undefined) return;
      if (treeItem instanceof TreeItemScript) {
        for (const parentItem of this.treeItems) {
          if (treeItem.parent !== parentItem.label) continue;
          (<TreeItemObject>parentItem).onDisk.add(Name);
          break;
        }
      }
      await treeItem.download(text, this.folder);
    }
    return this._onDidChangeTreeData.fire(null);
  }
}

class TreeItemObject extends vscode.TreeItem {
  label: string;
  parent: string;
  onDisk: Set<string>;
  children: TreeItemScript[] = [];
  constructor(label: string, onDisk: Set<string>) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = label;
    this.parent = label;
    this.onDisk = onDisk;
    if (this.onDisk.size > 0) this.iconPath = checkmarkIcon;
  }
  getProperties(objectUrl: string, scriptUrl: string): TreeItemProperties {
    return {
      message: `${this.label} ${objectUrl} scripts`,
      path: [this.label, scriptUrl].join("/"),
      condition: Settings.defaultScriptFetching !== "None - always ask",
      value: Settings.defaultScriptFetching,
      options: ["Yes", "Only method names", "No"],
    };
  }
  async download(data: RestResponse[], folder: vscode.Uri, isScript: boolean) {
    this.children = [];
    for (const script of data) {
      const { Name, Script } = script;
      if (isScript) this.onDisk.add(Name);
      const child = new TreeItemScript(Name, this.label, this.onDisk.has(Name));
      this.children.push(child);
      if (!isScript || Script === undefined) continue;
      await child.download(Script, folder);
    }
    if (isScript) this.iconPath = checkmarkIcon;
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
      message: `${this.label} script of the ${this.parent} ${objectUrl}`,
      path: [this.parent, scriptUrl, this.label].join("/"),
      condition: Settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
    };
  }
  async download(text: string, folder: vscode.Uri) {
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
  parent = "";
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIcon;
  }
  getProperties(objectUrl: string): TreeItemProperties {
    return {
      message: `${this.label} ${objectUrl} definition`,
      path: this.label,
      condition: Settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
    };
  }
  async download(text: string, folder: vscode.Uri) {
    const fileUri = vscode.Uri.joinPath(folder, `${this.label}.html`);
    this.iconPath = checkmarkIcon;
    await Utils.writeFile(fileUri, text, true);
  }
}
