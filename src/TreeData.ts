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
    if (err.response?.status === 404) return [];
    vscode.window.showErrorMessage(
      `Error using the Siebel REST API: ${
        err.response?.data?.ERROR ?? err.message
      }`
    );
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
  private readonly urlParts;
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
    if (type === "webtemp") return;
    treeView.onDidExpandElement(
      async ({ element }) => await this.selectTreeItem(<TreeItemObject>element)
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
      const data = await getData(this.urlParts.parent, {
        fields: "Name",
        searchspec: `Name LIKE '${searchSpec}*'`,
      });
      await this.setTreeItems(data);
      this._onDidChangeTreeData.fire(null);
      timeoutId = null;
    }, 300);
  }

  private async getFilesOnDisk(folderUri: vscode.Uri) {
    const files: OnDisk = new Map(),
      isFolder = await exists(folderUri);
    if (!isFolder) return files;
    const content = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [nameExt, fileType] of content) {
      if (fileType !== 1) continue;
      const [name, ext] = nameExt.split(".");
      if (!this.isFileValid(ext)) continue;
      files.set(name, `.${ext}`);
    }
    return files;
  }

  private async setTreeItemsScript(data: RestResponse) {
    for (const { Name } of data) {
      const folderUri = vscode.Uri.joinPath(this.folderUri, Name),
        onDisk = await this.getFilesOnDisk(folderUri);
      this.treeItems.push(
        new TreeItemObject(Name, onDisk, folderUri, this.urlParts)
      );
    }
  }

  private async setTreeItemsWebTemp(data: RestResponse) {
    const onDisk = await this.getFilesOnDisk(this.folderUri);
    for (const { Name } of data) {
      this.treeItems.push(new TreeItemWebTemp(Name, onDisk, this.folderUri));
    }
  }

  private async selectTreeItem(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    const didTreeChange = await treeItem.select();
    if (!didTreeChange) return;
    this._onDidChangeTreeData.fire(null);
  }
}

class TreeItemWebTemp extends vscode.TreeItem {
  override readonly label: string;
  override readonly collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.None;
  readonly onDisk;
  readonly folderUri;
  readonly answerOptions: AnswerOptions = yesNo;
  readonly field: Field = "Definition";
  readonly message: string = "web template";
  url = "";

  constructor(label: string, onDisk: OnDisk, folderUri: vscode.Uri) {
    super(label);
    this.label = label;
    this.onDisk = onDisk;
    this.folderUri = folderUri;
    if (new.target !== TreeItemWebTemp) return;
    this.url = ["Web Template", label].join("/");
    if (!onDisk.has(label)) return;
    this.iconPath = checkmarkIcon;
  }

  get condition() {
    return settings.singleFileAutoDownload;
  }
  get answerWhenTrue(): AnswerWhenTrue {
    return "Yes";
  }
  get ext(): FileExt {
    return ".html";
  }

  async select() {
    const answer = this.condition
        ? this.answerWhenTrue
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${this.label} ${this.message} from Siebel?`,
            ...this.answerOptions
          ),
      params: QueryParams = {};
    switch (answer) {
      case "Yes":
      case "All scripts":
        params.fields = `Name,${this.field}`;
      case "Only method names":
        params.fields ??= "Name";
        const data = await getData(this.url, params);
        if (data.length === 0) return false;
        return await this.pull(data);
      default:
        return false;
    }
  }

  async pull([{ [this.field]: text }]: RestResponse) {
    const fileUri = vscode.Uri.joinPath(
        this.folderUri,
        `${this.label}${this.ext}`
      ),
      answer = !this.onDisk.has(this.label)
        ? "Overwrite"
        : settings.defaultActionWhenFileExists !== "None - always ask"
        ? settings.defaultActionWhenFileExists
        : await vscode.window.showInformationMessage(
            `The ${this.label} ${this.message} is already downloaded, would you like to open it, or pull it from Siebel and overwrite the file?`,
            ...openFileOverwriteCancel
          );
    switch (answer) {
      case "Overwrite":
        if (text === undefined) return false;
        this.onDisk.set(this.label, this.ext);
        this.iconPath = checkmarkIcon;
        await writeFile(fileUri, text);
      case "Open file":
        await openFile(fileUri);
        return answer === "Overwrite";
      default:
        return false;
    }
  }
}

class TreeItemScript extends TreeItemWebTemp {
  override readonly field: Field = "Script";
  override readonly message = "server script";

  constructor(
    label: string,
    onDisk: OnDisk,
    folderUri: vscode.Uri,
    url: string
  ) {
    super(label, onDisk, folderUri);
    this.url = [url, label].join("/");
    if (!onDisk.has(label)) return;
    this.iconPath = checkmarkIcon;
  }

  override get ext() {
    return this.onDisk.get(this.label) ?? settings.localFileExtension;
  }
}

class TreeItemObject extends TreeItemWebTemp {
  override readonly collapsibleState =
    vscode.TreeItemCollapsibleState.Collapsed;
  override readonly answerOptions = yesOnlyMethodNamesNo;
  override readonly message = "server scripts";
  children: TreeItemScript[] = [];

  constructor(
    label: string,
    onDisk: OnDisk,
    folderUri: vscode.Uri,
    urlParts: UrlParts
  ) {
    super(label, onDisk, folderUri);
    this.url = [urlParts.parent, label, urlParts.child].join("/");
    if (onDisk.size === 0) return;
    this.iconPath = checkmarkIcon;
  }

  override get condition() {
    return settings.defaultScriptFetching !== "None - always ask";
  }
  override get answerWhenTrue() {
    return settings.defaultScriptFetching;
  }

  override async pull(data: RestResponse) {
    this.children = [];
    for (const item of data) {
      const { Name, Script } = item,
        child = new TreeItemScript(Name, this.onDisk, this.folderUri, this.url);
      this.children.push(child);
      if (Script === undefined) continue;
      await child.pull([item]);
    }
    if (this.onDisk.size === 0) return true;
    this.iconPath = checkmarkIcon;
    return true;
  }
}
