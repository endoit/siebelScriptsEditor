import * as vscode from "vscode";
import { entity } from "./constants";
import { exists, writeFile } from "./utils";
import { settings } from "./settings";
import axios from "axios";

const checkmarkIcon = new vscode.ThemeIcon("check");

export class TreeData {
  private readonly type: SiebelObject;
  private readonly objectUrl: string;
  private readonly scriptUrl: string;
  private readonly setTreeItems:
    | typeof this.setTreeItemsScript
    | typeof this.setTreeItemsWebTemp;
  private readonly nameField: NameField;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private timeoutId: NodeJS.Timeout | number | null = null;
  private folder!: vscode.Uri;
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
    if (type !== "webtemp")
      treeView.onDidExpandElement(
        async ({ element }) =>
          await this.selectTreeItem(<TreeItemObject>element)
      );
  }

  setFolder(folderUri: vscode.Uri) {
    this.folder = vscode.Uri.joinPath(folderUri, this.type);
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

  async getData(url: string, params: QueryParams): Promise<RestResponse[]> {
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
  }

  async search(searchSpec: string) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(async () => {
      this.treeItems = [];
      const fields = "Name",
        searchspec = `Name LIKE '${searchSpec}*'`,
        data = await this.getData(this.objectUrl, { fields, searchspec });
      await this.setTreeItems(data);
      this._onDidChangeTreeData.fire(null);
      this.timeoutId = null;
    }, 300);
  }

  private async getFilesOnDisk(parent = "") {
    const files: Set<string> = new Set(),
      directoryUri = vscode.Uri.joinPath(this.folder, parent);
    if (!(await exists(directoryUri))) return files;
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
    const { message, condition, value, options, url } = treeItem.question(
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
      fields = namesOnly ? "Name" : this.nameField;
    if (answer !== "Yes" && answer !== "All scripts" && !namesOnly) return;
    const data = await this.getData(url, { fields });
    await treeItem.select(data, this.folder);
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
      condition: settings.defaultScriptFetching !== "None - always ask",
      value: settings.defaultScriptFetching,
      options: ["Yes", "Only method names", "No"],
      url: [objectUrl, this.label, scriptUrl].join("/"),
    };
  }

  async select(data: RestResponse[], folder: vscode.Uri) {
    this.children = [];
    for (const script of data) {
      const child = new TreeItemScript(script.Name, this.label, this.onDisk);
      this.children.push(child);
      if (!script.Script) continue;
      await child.select([script], folder);
    }
    if (this.onDisk.size > 0) this.iconPath = checkmarkIcon;
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
      condition: settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
      url: [objectUrl, this.parent, scriptUrl, this.label].join("/"),
    };
  }

  async select(data: RestResponse[], folder: vscode.Uri) {
    const folderUri = vscode.Uri.joinPath(folder, this.parent);
    if (this.iconPath) {
      const answer =
        settings.defaultActionWhenFileExists !== "None - always ask"
          ? settings.defaultActionWhenFileExists
          : await vscode.window.showInformationMessage(
              `The ${this.label} script is already downloaded, would you like to open it or pull from Siebel and overwrite the file?`,
              "Open file",
              "Overwrite",
              "Cancel"
            );
      if (answer === "Open file") {
        const fileUriJs = vscode.Uri.joinPath(folderUri, `${this.label}.js`),
          fileUriTs = vscode.Uri.joinPath(folderUri, `${this.label}.ts`),
          fileUriOpen = (await exists(fileUriJs)) ? fileUriJs : fileUriTs;
        return await vscode.window.showTextDocument(fileUriOpen, {
          preview: false,
        });
      }
      if (answer === "Cancel" || !answer) return;
    }
    const text = data?.[0]?.Script;
    if (text === undefined) return;
    const fileUri = vscode.Uri.joinPath(
      folderUri,
      `${this.label}${settings.localFileExtension}`
    );
    this.onDisk.add(this.label);
    this.iconPath = checkmarkIcon;
    await writeFile(fileUri, text, true);
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
      condition: settings.singleFileAutoDownload,
      value: "Yes",
      options: ["Yes", "No"],
      url: [objectUrl, this.label].join("/"),
    };
  }

  async select(data: RestResponse[], folder: vscode.Uri) {
    const fileUri = vscode.Uri.joinPath(folder, `${this.label}.html`);
    if (this.iconPath) {
      const answer =
        settings.defaultActionWhenFileExists !== "None - always ask"
          ? settings.defaultActionWhenFileExists
          : await vscode.window.showInformationMessage(
              `The ${this.label} web template is already downloaded, would you like to open it or pull from Siebel and overwrite the file?`,
              "Open file",
              "Overwrite",
              "Cancel"
            );
      if (answer === "Open file") {
        return await vscode.window.showTextDocument(fileUri, {
          preview: false,
        });
      }
      if (answer === "Cancel" || !answer) return;
    }
    const text = data?.[0]?.Definition;
    if (text === undefined) return;
    this.iconPath = checkmarkIcon;
    await writeFile(fileUri, text, true);
  }
}
