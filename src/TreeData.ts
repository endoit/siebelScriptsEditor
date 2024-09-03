import * as vscode from "vscode";
import {
  openFileOverwriteCancel,
  siebelObjectUrls,
  yesNo,
  yesOnlyMethodNamesNo,
} from "./constants";
import { exists, writeFile } from "./utils";
import { settings } from "./settings";
import axios from "axios";

const checkmarkIcon = new vscode.ThemeIcon("check");
let timeoutId: NodeJS.Timeout | number | null = null;

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
  private treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];
  private declare folderUri: vscode.Uri;

  constructor(type: Type) {
    this.urlParts = siebelObjectUrls[type];
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

  set folder(folderUri: vscode.Uri) {
    this.folderUri = folderUri;
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
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      this.treeItems = [];
      const fields = "Name",
        searchspec = `Name LIKE '${searchSpec}*'`,
        data = await getData(this.urlParts.parent, { fields, searchspec });
      await this.setTreeItems(data);
      this._onDidChangeTreeData.fire(null);
      timeoutId = null;
    }, 300);
  }

  private async getFilesOnDisk(parent = "") {
    const files: OnDisk = new Map(),
      directoryUri = vscode.Uri.joinPath(this.folderUri, parent);
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
    const didTreeChange = await treeItem.select(this.folderUri);
    if (!didTreeChange) return;
    this._onDidChangeTreeData.fire(null);
  }
}

class TreeItemScript extends vscode.TreeItem {
  override readonly label: string;
  override readonly collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.None;
  readonly onDisk;
  readonly answerOptions: AnswerOptions = yesNo;
  readonly field: Field = "Script";
  declare message: string;
  declare url: string;
  private readonly parent: string;

  constructor(label: string, onDisk: OnDisk, parent = "", urlParts?: UrlParts) {
    super(label);
    this.label = label;
    this.onDisk = onDisk;
    this.parent = parent;
    this.icon = checkmarkIcon;
    if (!parent || !urlParts) return;
    this.message = `script of the ${parent} ${urlParts.parent}`;
    this.url = [urlParts.parent, parent, urlParts.child, label].join("/");
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
  set icon(themeIcon: vscode.ThemeIcon) {
    if (!this.onDisk.has(this.label)) return;
    this.iconPath = themeIcon;
  }

  async select(folderUri: vscode.Uri) {
    const answer = this.condition
        ? this.answerWhenTrue
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${this.label} ${this.message} from Siebel?`,
            ...this.answerOptions
          ),
      namesOnly = answer === "Only method names";
    if (answer !== "Yes" && answer !== "All scripts" && !namesOnly)
      return false;
    const data = await getData(this.url, {
      fields: namesOnly ? "Name" : `Name,${this.field}`,
    });
    if (data.length === 0) return false;
    return await this.pull(data, folderUri);
  }

  async pull([{ [this.field]: text }]: RestResponse, folderUri: vscode.Uri) {
    const fileUri = vscode.Uri.joinPath(
        folderUri,
        this.parent,
        `${this.label}${this.ext}`
      ),
      answer = !this.onDisk.has(this.label)
        ? "Overwrite"
        : settings.defaultActionWhenFileExists !== "None - always ask"
        ? settings.defaultActionWhenFileExists
        : await vscode.window.showInformationMessage(
            `The ${this.label} item is already downloaded, would you like to open it, or pull it from Siebel and overwrite the file?`,
            ...openFileOverwriteCancel
          );
    if (answer === "Open file") await openFile(fileUri);
    if (answer !== "Overwrite" || text === undefined) return false;
    this.onDisk.set(this.label, this.ext);
    this.iconPath = checkmarkIcon;
    await writeFile(fileUri, text);
    await openFile(fileUri);
    return true;
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
    this.url = [urlParts.parent, label, urlParts.child].join("/");
    this.icon = checkmarkIcon;
  }

  override get condition() {
    return settings.defaultScriptFetching !== "None - always ask";
  }
  override get answerWhenTrue() {
    return settings.defaultScriptFetching;
  }
  override set icon(themeIcon: vscode.ThemeIcon) {
    if (this.onDisk.size === 0) return;
    this.iconPath = themeIcon;
  }

  override async pull(data: RestResponse, folderUri: vscode.Uri) {
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
      await child.pull([item], folderUri);
    }
    this.icon = checkmarkIcon;
    return true;
  }
}

class TreeItemWebTemp extends TreeItemScript {
  override readonly field = "Definition";
  override readonly message = "Web Template definition";

  constructor(label: string, onDisk: OnDisk) {
    super(label, onDisk);
    this.url = ["Web Template", label].join("/");
    this.icon = checkmarkIcon;
  }

  override get ext(): ".html" {
    return ".html";
  }
}
