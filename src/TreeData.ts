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
      const params: QueryParams = {
          fields: "Name",
          searchspec: `Name LIKE '${searchSpec}*'`,
        },
        data = await getData(this.urlParts.parent, params);
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
        onDisk = await this.getFilesOnDisk(folderUri),
        url = [this.urlParts.parent, Name, this.urlParts.child].join("/");
      this.treeItems.push(new TreeItemObject(Name, url, onDisk, folderUri));
    }
  }

  private async setTreeItemsWebTemp(data: RestResponse) {
    const onDisk = await this.getFilesOnDisk(this.folderUri);
    for (const { Name } of data) {
      const url = [this.urlParts.parent, Name].join("/");
      this.treeItems.push(
        new TreeItemWebTemp(Name, url, onDisk, this.folderUri)
      );
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

class TreeItemScript extends vscode.TreeItem {
  override readonly collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.None;
  declare readonly label: string;
  readonly url: string;
  readonly onDisk;
  readonly folderUri;

  constructor(
    label: string,
    url: string,
    onDisk: OnDisk,
    folderUri: vscode.Uri
  ) {
    super(label);
    this.url = url;
    this.onDisk = onDisk;
    this.folderUri = folderUri;
    this.icon = checkmarkIcon;
  }

  get field(): Field {
    return "Script";
  }
  get ext() {
    return this.onDisk.get(this.label) ?? settings.localFileExtension;
  }
  set icon(iconPath: vscode.ThemeIcon) {
    if (!this.onDisk.has(this.label)) return;
    this.iconPath = iconPath;
  }

  async getAnswer(): Promise<Answer> {
    return settings.singleFileAutoDownload
      ? "Yes"
      : await vscode.window.showInformationMessage(
          `Do you want to get the ${this.label} from Siebel?`,
          ...yesNo
        );
  }

  async select() {
    const answer = await this.getAnswer(),
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
            `The ${this.label} is already downloaded, would you like to open it, or pull it from Siebel and overwrite the file?`,
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

class TreeItemWebTemp extends TreeItemScript {
  override get field(): Field {
    return "Definition";
  }
  override get ext(): FileExt {
    return ".html";
  }
}

class TreeItemObject extends TreeItemScript {
  override readonly collapsibleState =
    vscode.TreeItemCollapsibleState.Collapsed;
  children: TreeItemScript[] = [];

  override set icon(iconPath: vscode.ThemeIcon) {
    if (this.onDisk.size === 0) return;
    this.iconPath = iconPath;
  }

  override async getAnswer() {
    return settings.defaultScriptFetching !== "None - always ask"
      ? settings.defaultScriptFetching
      : await vscode.window.showInformationMessage(
          `Do you want to get all server scripts of the ${this.label} from Siebel?`,
          ...yesOnlyMethodNamesNo
        );
  }

  override async pull(data: RestResponse) {
    this.children = [];
    for (const item of data) {
      const { Name, Script } = item,
        url = [this.url, Name].join("/"),
        child = new TreeItemScript(Name, url, this.onDisk, this.folderUri);
      this.children.push(child);
      if (Script === undefined) continue;
      await child.pull([item]);
    }
    this.icon = checkmarkIcon;
    return true;
  }
}
