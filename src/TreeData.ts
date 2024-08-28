import * as vscode from "vscode";
import { entity } from "./constants";
import { exists, writeFile } from "./utils";
import { settings } from "./settings";
import axios from "axios";

const checkmarkIcon = new vscode.ThemeIcon("check");

const getData = async (
  url: string,
  params: QueryParams
): Promise<RestResponse> => {
  try {
    const response = await axios({ url, params });
    return response?.data?.items ?? [];
  } catch (err: any) {
    if (err.response?.status !== 404) {
      vscode.window.showErrorMessage(
        `Error using the Siebel REST API: ${
          err.response?.data?.ERROR ?? err.message
        }`
      );
    }
    return [];
  }
};
const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
const isFileScript = (ext: string): ext is "js" | "ts" =>
  ext === "js" || ext === "ts";
const isFileWebTemp = (ext: string): ext is "html" => ext === "html";

export class TreeData {
  private readonly objectUrl: string;
  private readonly scriptUrl: string;
  private readonly setTreeItems: (data: RestResponse) => Promise<void>;
  private readonly isFileValid: (ext: string) => ext is "js" | "ts" | "html";
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];
  declare folder: vscode.Uri;

  constructor(type: SiebelObject) {
    this.objectUrl = entity[type].parent;
    this.scriptUrl = entity[type].child;
    [this.setTreeItems, this.isFileValid] =
      type !== "webtemp"
        ? [this.setTreeItemsScript, isFileScript]
        : [this.setTreeItemsWebTemp, isFileWebTemp];
    const treeView = vscode.window.createTreeView(type, {
      treeDataProvider: this,
      showCollapseAll: type !== "webtemp",
    });
    treeView.onDidChangeSelection(async ({ selection: [treeItem] }) => {
      if (treeItem === undefined || treeItem instanceof TreeItemObject) return;
      await this.selectTreeItem(<TreeItemScript | TreeItemWebTemp>treeItem);
    });
    if (type !== "webtemp")
      treeView.onDidExpandElement(
        async ({ element }) =>
          await this.selectTreeItem(<TreeItemObject>element)
      );
  }

  clear() {
    this.treeItems = [];
    this._onDidChangeTreeData.fire(null);
  }

  getChildren(treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
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
      const fields = "Name",
        searchspec = `Name LIKE '${searchSpec}*'`,
        data = await getData(this.objectUrl, { fields, searchspec });
      await this.setTreeItems(data);
      this._onDidChangeTreeData.fire(null);
      this.timeoutId = null;
    }, 300);
  }

  private async getFilesOnDisk(parent = "") {
    const files: OnDisk = new Map(),
      directoryUri = vscode.Uri.joinPath(this.folder, parent);
    if (!(await exists(directoryUri))) return files;
    const content = await vscode.workspace.fs.readDirectory(directoryUri);
    for (const [nameExt, type] of content) {
      if (type !== 1) continue;
      const [name, ext] = nameExt.split(".");
      if (!this.isFileValid(ext)) continue;
      files.set(name, `.${ext}`);
    }
    return files;
  }

  private async setTreeItemsScript(data: RestResponse) {
    for (const { Name } of data) {
      const onDisk = await this.getFilesOnDisk(Name);
      this.treeItems.push(new TreeItemObject(Name, onDisk));
    }
  }

  private async setTreeItemsWebTemp(data: RestResponse) {
    const onDisk = await this.getFilesOnDisk();
    for (const { Name } of data) {
      this.treeItems.push(new TreeItemWebTemp(Name, onDisk.has(Name)));
    }
  }

  private async selectTreeItem(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    const didTreeChange = await treeItem.select(
      this.objectUrl,
      this.scriptUrl,
      this.folder
    );
    if (!didTreeChange) return;
    this._onDidChangeTreeData.fire(null);
  }
}

abstract class TreeItemBase extends vscode.TreeItem {
  declare readonly label: string;
  abstract getRequest(objectUrl: string, scriptUrl: string): TreeItemRequest;
  abstract pull(data: RestResponse, folder: vscode.Uri): Promise<boolean>;

  constructor(label: string, collapse = vscode.TreeItemCollapsibleState.None) {
    super(label, collapse);
  }

  async select(objectUrl: string, scriptUrl: string, folder: vscode.Uri) {
    const { message, condition, value, options, url, fields } = this.getRequest(
        objectUrl,
        scriptUrl
      ),
      answer = condition
        ? value
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${message} from Siebel?`,
            ...options
          ),
      namesOnly = answer === "Only method names";
    if (answer !== "Yes" && answer !== "All scripts" && !namesOnly)
      return false;
    const data = await getData(url, { fields: namesOnly ? "Name" : fields });
    if (data.length === 0) return false;
    return await this.pull(data, folder);
  }

  async checkFileOnDisk(fileUri: vscode.Uri) {
    if (!this.iconPath) return "Overwrite";
    const answer =
      settings.defaultActionWhenFileExists !== "None - always ask"
        ? settings.defaultActionWhenFileExists
        : await vscode.window.showInformationMessage(
            `The ${this.label} item is already downloaded, would you like to open it, or pull it from Siebel and overwrite the file?`,
            "Open file",
            "Overwrite",
            "Cancel"
          );
    if (answer !== "Open file") return answer;
    await openFile(fileUri);
    return answer;
  }
}

class TreeItemObject extends TreeItemBase {
  private readonly onDisk: OnDisk;
  children: TreeItemScript[] = [];

  constructor(label: string, onDisk: OnDisk) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.onDisk = onDisk;
    if (this.onDisk.size > 0) this.iconPath = checkmarkIcon;
  }

  getRequest(objectUrl: string, scriptUrl: string): TreeItemRequest {
    return {
      message: `${this.label} ${objectUrl} scripts`,
      condition: settings.defaultScriptFetching !== "None - always ask",
      value: settings.defaultScriptFetching,
      options: ["Yes", "Only method names", "No"],
      url: [objectUrl, this.label, scriptUrl].join("/"),
      fields: "Name,Script",
    };
  }

  async pull(data: RestResponse, folder: vscode.Uri) {
    this.children = [];
    for (const item of data) {
      const child = new TreeItemScript(item.Name, this.label, this.onDisk);
      this.children.push(child);
      if (item.Script === undefined) continue;
      await child.pull([item], folder);
    }
    if (this.onDisk.size > 0) this.iconPath = checkmarkIcon;
    return true;
  }
}

class TreeItemScript extends TreeItemBase {
  private readonly parent: string;
  private readonly onDisk: OnDisk;

  constructor(label: string, parent: string, onDisk: OnDisk) {
    super(label);
    this.parent = parent;
    this.onDisk = onDisk;
    if (onDisk.has(label)) this.iconPath = checkmarkIcon;
  }

  getRequest(objectUrl: string, scriptUrl: string): TreeItemRequest {
    return {
      message: `${this.label} script of the ${this.parent} ${objectUrl}`,
      condition: settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
      url: [objectUrl, this.parent, scriptUrl, this.label].join("/"),
      fields: "Name,Script",
    };
  }

  async pull([{ Script }]: RestResponse, folder: vscode.Uri) {
    const ext = this.onDisk.get(this.label) ?? settings.localFileExtension,
      fileUri = vscode.Uri.joinPath(folder, this.parent, `${this.label}${ext}`),
      answer = await this.checkFileOnDisk(fileUri);
    if (answer !== "Overwrite" || Script === undefined) return false;
    this.onDisk.set(this.label, ext);
    this.iconPath = checkmarkIcon;
    await writeFile(fileUri, Script);
    await openFile(fileUri);
    return true;
  }
}

class TreeItemWebTemp extends TreeItemBase {
  constructor(label: string, isOnDisk: boolean) {
    super(label);
    if (isOnDisk) this.iconPath = checkmarkIcon;
  }

  getRequest(objectUrl: string): TreeItemRequest {
    return {
      message: `${this.label} ${objectUrl} definition`,
      condition: settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
      url: [objectUrl, this.label].join("/"),
      fields: "Name,Definition",
    };
  }

  async pull([{ Definition }]: RestResponse, folder: vscode.Uri) {
    const fileUri = vscode.Uri.joinPath(folder, `${this.label}.html`),
      answer = await this.checkFileOnDisk(fileUri);
    if (answer !== "Overwrite" || Definition === undefined) return false;
    this.iconPath = checkmarkIcon;
    await writeFile(fileUri, Definition);
    await openFile(fileUri);
    return true;
  }
}
