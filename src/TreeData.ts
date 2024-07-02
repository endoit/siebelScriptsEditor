import * as vscode from "vscode";
import {
  entity,
  NAME,
  NAMESCRIPT,
  DEFINITION,
  WEBTEMP,
  OPEN_FILE,
  NAMEDEFINITION,
  SCRIPT,
  NAMES_ONLY,
} from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import axios from "axios";

const checkmarkIcon = new vscode.ThemeIcon("check");

export class TreeData {
  private readonly type: SiebelObject;
  private readonly objectUrl: string;
  private readonly scriptUrl: string;
  private readonly field: DataField;
  private readonly fields: NameDataFields;
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
    this.isScript = type !== WEBTEMP;
    if (this.isScript) {
      this.TreeItem = TreeItemObject;
      this.field = SCRIPT;
      this.fields = NAMESCRIPT;
    } else {
      this.TreeItem = TreeItemWebTemp;
      this.field = DEFINITION;
      this.fields = NAMEDEFINITION;
    }
    vscode.window
      .createTreeView(type, {
        treeDataProvider: this,
        showCollapseAll: this.isScript,
      })
      .onDidChangeSelection(async (e) => await this.selectionChange(e as any));
  }

  set folder(workspaceUri: vscode.Uri) {
    this._folder = Utils.joinUri(workspaceUri, this.type);
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

  private async getData(url: string, namesOnly: boolean, searchSpec?: string) {
    try {
      const params: QueryParams = {
        fields: namesOnly ? NAME : this.fields,
        searchspec: searchSpec ? `Name LIKE '${searchSpec}*'` : undefined,
      };
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

  private async getFilesOnDisk(parent = "") {
    const files: OnDiskObject = {},
      directoryUri = Utils.joinUri(this.folder, parent);
    if (!(await Utils.exists(directoryUri))) return files;
    const content = await vscode.workspace.fs.readDirectory(directoryUri);
    for (const [fullName, type] of content) {
      if (type !== 1) continue;
      const [name, ext] = fullName.split(".");
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
    const data = await this.getData(this.objectUrl, NAMES_ONLY, searchSpec);
    this.dataObject = {};
    if (this.isScript) {
      for (const { Name } of data) {
        this.dataObject[Name] = await this.getFilesOnDisk(Name);
      }
    } else {
      const onDiskObject = await this.getFilesOnDisk();
      for (const { Name } of data) {
        this.dataObject[Name] = !!onDiskObject[Name];
      }
    }
    this.createTreeItems();
  }

  private async getAnswerAndUrl(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    let question = `Do you want to get the ${treeItem.label} ${this.objectUrl}`;
    switch (true) {
      case treeItem instanceof TreeItemObject:
        question = `${question} from Siebel?`;
        return {
          answer:
            Settings.defaultScriptFetching !== "None - always ask"
              ? Settings.defaultScriptFetching
              : await vscode.window.showInformationMessage(
                  question,
                  "Yes",
                  "Only method names",
                  "No"
                ),
          url: Utils.joinUrl(this.objectUrl, treeItem.label, this.scriptUrl),
        };
      case treeItem instanceof TreeItemScript:
        question = `${question} script from Siebel?`;
        return {
          answer: Settings.singleFileAutoDownload
            ? "Yes"
            : await vscode.window.showInformationMessage(question, "Yes", "No"),
          url: Utils.joinUrl(
            this.objectUrl,
            treeItem.parent,
            this.scriptUrl,
            treeItem.label
          ),
        };
      case treeItem instanceof TreeItemWebTemp:
        question = `${question} definition from Siebel?`;
        return {
          answer: Settings.singleFileAutoDownload
            ? "Yes"
            : await vscode.window.showInformationMessage(question, "Yes", "No"),
          url: Utils.joinUrl(this.objectUrl, treeItem.label),
        };
      default:
        return { answer: "No", url: "" };
    }
  }

  private async selectionChange({
    selection: [treeItem],
  }: vscode.TreeViewSelectionChangeEvent<
    TreeItemObject | TreeItemScript | TreeItemWebTemp
  >) {
    if (!treeItem) return;
    const { label, parent } = treeItem,
      { answer, url } = await this.getAnswerAndUrl(treeItem),
      namesOnly = answer === "Only method names";
    if (!(answer === "Yes" || answer === "All scripts" || namesOnly)) return;
    const data = await this.getData(url, namesOnly);
    if (this.isScript) {
      for (const { Name, [this.field]: text } of data) {
        this.dataObject = this.dataObject as ScriptObject;
        if (!this.dataObject[parent][Name])
          this.dataObject[parent][Name] = !namesOnly;
        if (namesOnly || !text) continue;
        const fileName = `${Name}${Settings.localFileExtension}`,
          fileUri = Utils.joinUri(this.folder, parent, fileName);
        await Utils.writeFile(fileUri, text, OPEN_FILE);
      }
    } else {
      const text = data?.[0]?.[this.field];
      if (text === undefined) return;
      this.dataObject[label] = true;
      const fileName = `${label}.html`,
        fileUri = Utils.joinUri(this.folder, fileName);
      await Utils.writeFile(fileUri, text, OPEN_FILE);
    }
    this.createTreeItems();
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
}

class TreeItemWebTemp extends vscode.TreeItem {
  label: string;
  parent = "";
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIcon;
  }
}
