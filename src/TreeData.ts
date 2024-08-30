import * as vscode from "vscode";
import {
  openFileOverwriteCancel,
  urlObject,
  yesNo,
  yesOnlyMethodNamesNo,
} from "./constants";
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
  private readonly urlParts: UrlParts;
  private readonly setTreeItems: (data: RestResponse) => Promise<void>;
  private readonly isFileValid: (ext: string) => ext is "js" | "ts" | "html";
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];
  declare folder: vscode.Uri;

  constructor(type: SiebelObject) {
    this.urlParts = urlObject[type];
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
        data = await getData(this.urlParts.parent, { fields, searchspec });
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
      this.treeItems.push(new TreeItemObject(Name, onDisk, this.urlParts));
    }
  }

  private async setTreeItemsWebTemp(data: RestResponse) {
    const onDisk = await this.getFilesOnDisk();
    for (const { Name } of data) {
      this.treeItems.push(new TreeItemWebTemp(Name, onDisk));
    }
  }

  private async selectTreeItem(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    const didTreeChange = await treeItem.select(this.folder);
    if (!didTreeChange) return;
    this._onDidChangeTreeData.fire(null);
  }
}

class TreeItemScript extends vscode.TreeItem {
  declare readonly label: string;
  override readonly collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.None;
  readonly onDisk;
  readonly answerOptions: AnswerOptions = yesNo;
  readonly field: Field = "Script";
  declare message: string;
  declare url: string;
  private readonly parent;

  constructor(label: string, onDisk: OnDisk, parent = "", urlParts?: UrlParts) {
    super(label);
    this.label = label;
    this.onDisk = onDisk;
    this.parent = parent;
    this.setIcon();
    if (!parent || !urlParts) return;
    this.message = `script of the ${this.parent} ${urlParts.parent}`;
    this.url = [urlParts.parent, this.parent, urlParts.child, this.label].join(
      "/"
    );
  }

  get condition() {
    return settings.singleFileAutoDownload;
  }
  get answerWhenTrue(): AnswerWhenTrue {
    return "Yes";
  }
  get ext() {
    return this.onDisk.get(this.label) ?? settings.localFileExtension;
  }

  setIcon() {
    if (!this.onDisk.has(this.label)) return;
    this.iconPath = checkmarkIcon;
  }

  getFileUri(folder: vscode.Uri) {
    return vscode.Uri.joinPath(folder, this.parent, `${this.label}${this.ext}`);
  }

  async select(folder: vscode.Uri) {
    const answer = this.condition
        ? this.answerWhenTrue
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${this.label} ${this.message} from Siebel?`,
            ...this.answerOptions
          ),
      namesOnly = answer === "Only method names";
    if (answer !== "Yes" && answer !== "All scripts" && !namesOnly)
      return false;
    const fields = `Name,${namesOnly ? "" : this.field}` as const,
      data = await getData(this.url, { fields });
    if (data.length === 0) return false;
    return await this.pull(data, folder);
  }

  async pull([{ [this.field]: text }]: RestResponse, folder: vscode.Uri) {
    const fileUri = this.getFileUri(folder),
      answer = await this.checkFileOnDisk(fileUri);
    if (answer !== "Overwrite" || text === undefined) return false;
    this.onDisk.set(this.label, this.ext);
    this.iconPath = checkmarkIcon;
    await writeFile(fileUri, text);
    await openFile(fileUri);
    return true;
  }

  async checkFileOnDisk(fileUri: vscode.Uri) {
    if (!this.iconPath) return "Overwrite";
    const answer =
      settings.defaultActionWhenFileExists !== "None - always ask"
        ? settings.defaultActionWhenFileExists
        : await vscode.window.showInformationMessage(
            `The ${this.label} item is already downloaded, would you like to open it, or pull it from Siebel and overwrite the file?`,
            ...openFileOverwriteCancel
          );
    if (answer !== "Open file") return answer;
    await openFile(fileUri);
    return answer;
  }
}

class TreeItemObject extends TreeItemScript {
  override readonly collapsibleState =
    vscode.TreeItemCollapsibleState.Collapsed;
  override readonly answerOptions = yesOnlyMethodNamesNo;
  readonly urlParts;
  children: TreeItemScript[] = [];

  constructor(label: string, onDisk: OnDisk, urlParts: UrlParts) {
    super(label, onDisk);
    this.urlParts = urlParts;
    this.message = `${urlParts.parent} scripts`;
    this.url = [urlParts.parent, this.label, urlParts.child].join("/");
    this.setIcon();
  }

  override get condition() {
    return settings.defaultScriptFetching !== "None - always ask";
  }

  override get answerWhenTrue() {
    return settings.defaultScriptFetching;
  }

  override setIcon() {
    if (this.onDisk.size === 0) return;
    this.iconPath = checkmarkIcon;
  }

  override async pull(data: RestResponse, folder: vscode.Uri) {
    this.children = [];
    for (const item of data) {
      const child = new TreeItemScript(
        item.Name,
        this.onDisk,
        this.label,
        this.urlParts
      );
      this.children.push(child);
      if (item.Script === undefined) continue;
      await child.pull([item], folder);
    }
    this.setIcon();
    return true;
  }
}

class TreeItemWebTemp extends TreeItemScript {
  override readonly field = "Definition";

  constructor(label: string, onDisk: OnDisk) {
    super(label, onDisk);
    this.setIcon();
    this.message = `Web Template definition`;
    this.url = ["Web Template", this.label].join("/");
  }

  override get ext(): ".html" {
    return ".html";
  }

  override getFileUri(folder: vscode.Uri) {
    return vscode.Uri.joinPath(folder, `${this.label}.html`);
  }
}
