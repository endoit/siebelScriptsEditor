import * as vscode from "vscode";
import {
  metadata,
  baseConfig,
  baseScripts,
  query,
  fields,
  extDot,
} from "./constants";
import {
  createValidateInput,
  getScriptsOnDisk,
  getWebTempsOnDisk,
  joinPath,
  openFile,
  writeFile,
  readFile,
  getScriptParentsOnDisk,
  getFileUri,
} from "./utils";
import { settings } from "./settings";
import { create } from "axios";

export class TreeData {
  private static readonly restApi = create(baseConfig);
  private static timeoutId: NodeJS.Timeout | number | null = null;
  private static baseURL: string;
  static readonly icons = {
    none: undefined,
    disk: new vscode.ThemeIcon("clone", new vscode.ThemeColor("charts.blue")),
    siebel: new vscode.ThemeIcon(
      "cloud",
      new vscode.ThemeColor("charts.yellow")
    ),
    same: new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green")),
    differ: new vscode.ThemeIcon(
      "symbol-boolean",
      new vscode.ThemeColor("charts.red")
    ),
  } as const;
  protected readonly parentSegment: string;
  protected readonly childSegment: string;
  protected readonly _onDidChangeTreeData = new vscode.EventEmitter();
  protected treeItems: (TreeItemObject | TreeItemWebTemp)[] = [];
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  declare folderUri: vscode.Uri;

  constructor(type: Type) {
    this.parentSegment = metadata[type].parent;
    this.childSegment = metadata[type].child;
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

  private async selectTreeItem(
    treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp
  ) {
    //const didTreeChange =
    await treeItem.select();
    //if (!didTreeChange) return;
    if (treeItem.iconPath === TreeData.icons.none) return;
    this._onDidChangeTreeData.fire(null);
  }

  protected getSearchParams(searchSpec: string): QueryParams {
    return {
      fields: fields.name,
      searchspec: `Name LIKE '${searchSpec}*'`,
    };
  }

  protected async setTreeItems(data?: RestResponse) {
    const diskOnly = !data,
      source = data || (await getScriptParentsOnDisk(this.folderUri));
    this.treeItems = await Promise.all(
      source.map(async ({ Name: label }) => {
        const path = joinPath(this.parentSegment, label, this.childSegment),
          folderUri = vscode.Uri.joinPath(this.folderUri, label),
          onDisk = await getScriptsOnDisk(folderUri),
          iconPath = TreeData.getParentIcon(diskOnly, onDisk);
        return new TreeItemObject(label, path, onDisk, folderUri, iconPath);
      })
    );
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return treeItem;
  }

  getChildren(treeItem: TreeItemObject | TreeItemScript | TreeItemWebTemp) {
    return treeItem instanceof TreeItemObject
      ? treeItem.children
      : this.treeItems;
  }

  async search(searchSpec?: string) {
    if (TreeData.timeoutId) clearTimeout(TreeData.timeoutId);
    if (!searchSpec) return await this.setTreeItems();
    TreeData.timeoutId = setTimeout(async () => {
      const params = this.getSearchParams(searchSpec),
        data = await TreeData.getObject(this.parentSegment, params);
      await this.setTreeItems(data);
      TreeData.timeoutId = null;
    }, 300);
  }

  static getObject = async (
    path: string,
    params: QueryParams
  ): Promise<RestResponse> => {
    try {
      const response = await this.restApi.get(path, { params });
      return response?.data?.items ?? [];
    } catch (err: any) {
      if (err.response?.status !== 404)
        vscode.window.showErrorMessage(
          `Error using the Siebel REST API: ${
            err.response?.data?.ERROR ?? err.message
          }`
        );
      return [];
    }
  };

  static set restDefaults({ url, username, password }: RestConfig) {
    this.baseURL = url;
    this.restApi.defaults.auth = { username, password };
    this.restApi.defaults.params.PageSize = settings.maxPageSize;
  }

  static set workspaceUrl(workspace: string) {
    this.restApi.defaults.baseURL = joinPath(
      this.baseURL,
      "workspace",
      workspace
    );
  }

  static getParentIcon(diskOnly: boolean, onDisk: OnDisk) {
    return diskOnly
      ? TreeData.icons.none
      : onDisk.size === 0
      ? TreeData.icons.siebel
      : TreeData.icons.same;
  }

  static async getIcon(
    label: string,
    text: string | undefined,
    onDisk: OnDisk,
    folderUri: vscode.Uri
  ) {
    if (text === undefined) return TreeData.icons.none;
    if (!onDisk.has(label)) return TreeData.icons.siebel;
    const fileUri = getFileUri(folderUri, label, onDisk.get(label)!),
      fileContent = await readFile(fileUri);
    return fileContent === text ? TreeData.icons.same : TreeData.icons.differ;
  }
}

export class TreeDataWebTemp extends TreeData {
  constructor() {
    super("webtemp");
  }

  protected override getSearchParams(searchSpec: string): QueryParams {
    return {
      fields: query.pullDefinition.fields,
      searchspec: `Name LIKE '${searchSpec}*'`,
    };
  }

  protected override async setTreeItems(data?: RestResponse) {
    const onDisk = await getWebTempsOnDisk(this.folderUri),
      source =
        data ||
        [...onDisk.keys()].map((Name) => ({ Name, Definition: undefined }));
    this.treeItems = await Promise.all(
      source.map(async ({ Name: label, Definition: text }) => {
        const path = joinPath(this.parentSegment, label),
          iconPath = await TreeData.getIcon(
            label,
            text,
            onDisk,
            this.folderUri
          );
        return new TreeItemWebTemp(
          label,
          path,
          onDisk,
          this.folderUri,
          iconPath
        );
      })
    );
    this._onDidChangeTreeData.fire(null);
  }
}

class TreeItemScript extends vscode.TreeItem {
  override readonly collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.None;
  declare readonly label: string;
  readonly path: string;
  readonly onDisk;
  readonly folderUri;
  override readonly tooltip = "File is downloaded!";

  constructor(
    label: string,
    path: string,
    onDisk: OnDisk,
    folderUri: vscode.Uri,
    iconPath: vscode.ThemeIcon | undefined
  ) {
    super(label);
    this.path = path;
    this.onDisk = onDisk;
    this.folderUri = folderUri;
    this.iconPath = iconPath;
  }

  get ext(): FileExt {
    return this.onDisk.get(this.label) ?? settings.localFileExtension;
  }

  get field(): Field {
    return fields.script;
  }

  get params(): QueryParams {
    return query.pullScript;
  }

  get fileUri() {
    return getFileUri(this.folderUri, this.label, this.ext);
  }

  async select() {
    if (this.iconPath === TreeData.icons.siebel) {
      const data = await TreeData.getObject(this.path, this.params);
      if (data.length === 0) return;
      const { [this.field]: text } = data[0];
      if (text === undefined) return;
      await writeFile(this.fileUri, text);
      this.onDisk.set(this.label, this.ext);
      this.iconPath = TreeData.icons.same;
    }
    await openFile(this.fileUri);
  }

  async compare() {}
}

class TreeItemWebTemp extends TreeItemScript {
  override get ext() {
    return extDot.html;
  }

  override get field(): Field {
    return fields.definition;
  }

  override get params(): QueryParams {
    return query.pullDefinition;
  }
}

class TreeItemObject extends TreeItemScript {
  override readonly collapsibleState =
    vscode.TreeItemCollapsibleState.Collapsed;
  override readonly contextValue = "objectItem";
  children: TreeItemScript[] = [];

  private createChild(label: string, iconPath: vscode.ThemeIcon | undefined) {
    const path = joinPath(this.path, label);
    return new TreeItemScript(
      label,
      path,
      this.onDisk,
      this.folderUri,
      iconPath
    );
  }

  override async select() {
    const diskOnly = this.iconPath === TreeData.icons.none,
      data = diskOnly ? [] : await TreeData.getObject(this.path, this.params),
      inSiebel = new Set<string>(),
      siebel = await Promise.all(
        data.map(async ({ Name: label, Script: text }) => {
          const iconPath = await TreeData.getIcon(
            label,
            text,
            this.onDisk,
            this.folderUri
          );
          inSiebel.add(label);
          return this.createChild(label, iconPath);
        })
      ),
      iconPath = diskOnly ? TreeData.icons.none : TreeData.icons.disk,
      disk = [...this.onDisk.keys()]
        .filter((label) => !inSiebel.has(label))
        .map((label) => this.createChild(label, iconPath));
    this.children = [...siebel, ...disk].sort(({ label: a }, { label: b }) =>
      a.localeCompare(b)
    );
    this.iconPath = TreeData.getParentIcon(diskOnly, this.onDisk);
  }

  async pullAll() {}

  async refresh() {}

  async newScript() {
    const files = await getScriptsOnDisk(this.folderUri),
      items: vscode.QuickPickItem[] = [
        {
          label: "Custom",
          description: "Create a custom server script",
        },
        //...metadata[this.type].baseScriptItems,
      ];
    const options: vscode.QuickPickOptions = {
      title:
        "Choose the server script to be created or select Custom and enter its name",
      placeHolder: "Script",
      canPickMany: false,
    };
    const answer = await vscode.window.showQuickPick(items, options);
    if (!answer) return;
    let { label } = answer,
      content: string | undefined =
        baseScripts[<keyof typeof baseScripts>label];
    if (label === "Custom") {
      const validateInput = createValidateInput(files),
        label = await vscode.window.showInputBox({
          placeHolder: "Enter server script name",
          validateInput,
        });
      if (!label) return;
      content = `function ${label}(){\n\n}`;
    }
    const fileUri = getFileUri(
      this.folderUri,
      label,
      settings.localFileExtension
    );
    await writeFile(fileUri, content);
    await openFile(fileUri);
  }
}
