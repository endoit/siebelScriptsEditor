import * as vscode from "vscode";
import { metadata, baseConfig, query, fields } from "./constants";
import {
  workspaceUri,
  getScriptsOnDisk,
  getWebTempsOnDisk,
  joinPath,
  openFile,
  writeFile,
  readFile,
  getScriptParentsOnDisk,
  getFileUri,
  createNewScript,
  compareObjects,
  pullMissing,
} from "./utils";
import { settings } from "./settings";
import { create } from "axios";

const icons = {
    none: undefined,
    disk: new vscode.ThemeIcon(
      "device-desktop",
      new vscode.ThemeColor("charts.blue")
    ),
    siebel: new vscode.ThemeIcon(
      "cloud",
      new vscode.ThemeColor("charts.yellow")
    ),
    same: new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green")),
    differ: new vscode.ThemeIcon(
      "request-changes",
      new vscode.ThemeColor("charts.red")
    ),
    online: new vscode.ThemeIcon("plug", new vscode.ThemeColor("charts.green")),
  } as const,
  tooltips = new Map([
    [icons.none, undefined],
    [icons.disk, "Only on disk"],
    [icons.siebel, "Only in Siebel"],
    [icons.same, "Identical in Siebel and on disk"],
    [icons.differ, "Differs between Siebel and disk"],
    [icons.online, "Showing data from Siebel"],
  ]);

export const pullAllTree = async (treeItem: ObjectItem) =>
  await treeItem.pullAll();
export const refreshTree = async (treeItem: ObjectItem) =>
  await treeItem.refresh();
export const newScriptTree = async (treeItem: ObjectItem) =>
  await treeItem.newScript();
export const compareTree = async (treeItem: ScriptItem | WebTempItem) =>
  await treeItem.compare();

export class TreeView {
  private static readonly restApi = create(baseConfig);
  private static instance: TreeView;
  private static baseURL: string;
  static timeoutId: NodeJS.Timeout | number | null = null;
  static refresh: (
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) => void;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  private readonly treeData = {
    service: new BaseItem("service"),
    buscomp: new BaseItem("buscomp"),
    applet: new BaseItem("applet"),
    application: new BaseItem("application"),
    webtemp: new BaseItemWebTemp(),
  };
  private readonly treeItems = Object.values(this.treeData);
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private constructor() {
    const treeView = vscode.window.createTreeView("objectsView", {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    TreeView.refresh = (
      treeItem:
        | BaseItem
        | BaseItemWebTemp
        | ObjectItem
        | ScriptItem
        | WebTempItem
    ) => this._onDidChangeTreeData.fire(treeItem);
    treeView.onDidChangeSelection(async ({ selection: [treeItem] }) => {
      if (
        treeItem === undefined ||
        treeItem instanceof BaseItem ||
        treeItem instanceof BaseItemWebTemp ||
        treeItem instanceof ObjectItem
      )
        return;
      await (<ScriptItem | WebTempItem>treeItem).select();
    });
    treeView.onDidExpandElement(async ({ element }) => {
      if (element instanceof BaseItem || element instanceof BaseItemWebTemp)
        return;
      await (<ObjectItem>element).select();
    });
  }

  getTreeItem(
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) {
    return treeItem;
  }

  getChildren(
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) {
    return treeItem instanceof BaseItem ||
      treeItem instanceof BaseItemWebTemp ||
      treeItem instanceof ObjectItem
      ? treeItem.treeItems
      : this.treeItems;
  }

  async setFolder(connection: string, workspace: string) {
    for (const [type, treeItem] of Object.entries(this.treeData)) {
      treeItem.folderUri = vscode.Uri.joinPath(
        workspaceUri,
        connection,
        workspace,
        type
      );
      await treeItem.search();
    }
  }

  async search(type: Type, searchSpec?: string) {
    await this.treeData[type].search(searchSpec);
  }

  static getInstance() {
    TreeView.instance ??= new TreeView();
    return TreeView.instance;
  }

  static async getObject(
    path: string,
    params: QueryParams
  ): Promise<RestResponse> {
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
  }

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
      ? icons.none
      : onDisk.size === 0
      ? icons.siebel
      : icons.same;
  }

  static async getIcon(
    label: string,
    text: string | undefined,
    onDisk: OnDisk,
    folderUri: vscode.Uri
  ) {
    if (text === undefined) return icons.none;
    if (!onDisk.has(label)) return icons.siebel;
    const fileUri = getFileUri(folderUri, label, onDisk.get(label)!),
      fileContent = await readFile(fileUri);
    return fileContent === text ? icons.same : icons.differ;
  }
}

class BaseItem extends vscode.TreeItem {
  override collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.Expanded;
  protected readonly parentSegment;
  protected readonly childSegment;
  protected readonly searchFields: QueryParams["fields"] = fields.name;
  readonly baseScriptItems: readonly vscode.QuickPickItem[];
  declare folderUri: vscode.Uri;
  declare readonly label: string;
  treeItems: (ObjectItem | WebTempItem)[] = [];

  constructor(type: Type) {
    super(metadata[type].parent);
    this.parentSegment = metadata[type].parent;
    this.childSegment = metadata[type].child;
    this.baseScriptItems = metadata[type].baseScriptItems;
  }

  protected async setTreeItems(data?: RestResponse) {
    const diskOnly = !data,
      source = diskOnly ? await getScriptParentsOnDisk(this.folderUri) : data;
    this.iconPath = diskOnly ? icons.none : icons.online;
    this.tooltip = tooltips.get(this.iconPath);
    this.treeItems = await Promise.all(
      source.map(async ({ Name: label }) => {
        const path = joinPath(this.parentSegment, label, this.childSegment),
          folderUri = vscode.Uri.joinPath(this.folderUri, label),
          onDisk = await getScriptsOnDisk(folderUri),
          iconPath = TreeView.getParentIcon(diskOnly, onDisk);
        return new ObjectItem(label, path, onDisk, folderUri, iconPath, this);
      })
    );
    TreeView.refresh(this);
  }

  async search(searchSpec?: string) {
    if (TreeView.timeoutId) clearTimeout(TreeView.timeoutId);
    if (!searchSpec) return await this.setTreeItems();
    TreeView.timeoutId = setTimeout(async () => {
      const params = {
          fields: this.searchFields,
          searchSpec: `Name LIKE '${searchSpec}*'`,
        },
        data = await TreeView.getObject(this.parentSegment, params);
      await this.setTreeItems(data);
      TreeView.timeoutId = null;
    }, 300);
  }
}

class BaseItemWebTemp extends BaseItem {
  protected override readonly searchFields = query.pullDefinition.fields;

  constructor() {
    super("webtemp");
  }

  protected override async setTreeItems(data?: RestResponse) {
    const diskOnly = !data,
      onDisk = await getWebTempsOnDisk(this.folderUri),
      source = diskOnly
        ? [...onDisk.keys()].map((Name) => ({ Name, Definition: undefined }))
        : data;
    this.iconPath = diskOnly ? icons.none : icons.online;
    this.tooltip = tooltips.get(this.iconPath);
    this.treeItems = await Promise.all(
      source.map(async ({ Name: label, Definition: text }) => {
        const path = joinPath(this.parentSegment, label),
          iconPath = await TreeView.getIcon(
            label,
            text,
            onDisk,
            this.folderUri
          );
        return new WebTempItem(
          label,
          path,
          onDisk,
          this.folderUri,
          iconPath,
          this
        );
      })
    );
    TreeView.refresh(this);
  }
}

class ScriptItem extends vscode.TreeItem {
  override readonly collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.None;
  declare readonly label: string;
  readonly path: string;
  readonly folderUri;
  readonly parent;
  onDisk;

  constructor(
    label: string,
    path: string,
    onDisk: OnDisk,
    folderUri: vscode.Uri,
    iconPath: vscode.ThemeIcon | undefined,
    parent: BaseItem | BaseItemWebTemp | ObjectItem
  ) {
    super(label);
    this.path = path;
    this.onDisk = onDisk;
    this.folderUri = folderUri;
    this.icon = iconPath;
    this.parent = parent;
  }

  set icon(iconPath: vscode.ThemeIcon | undefined) {
    this.contextValue = iconPath === icons.differ ? "compareTree" : undefined;
    this.tooltip = tooltips.get(iconPath);
    this.iconPath = iconPath;
  }

  get ext(): FileExt {
    return this.onDisk.get(this.label) ?? settings.fileExtension;
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
    if (this.iconPath === icons.siebel) {
      const data = await TreeView.getObject(this.path, this.params);
      if (data.length === 0) return;
      const { [this.field]: text } = data[0];
      if (text === undefined) return;
      await writeFile(this.fileUri, text);
      this.onDisk.set(this.label, this.ext);
      this.icon = icons.same;
      if (this.parent) this.parent.iconPath = icons.same;
      TreeView.refresh(this.parent ? this.parent : this);
    }
    await openFile(this.fileUri);
  }

  async compare() {
    const response = await TreeView.getObject(this.path, this.params),
      compareMessage = `Comparison of ${this.label} in Siebel and on disk`;
    await compareObjects(
      response,
      this.field,
      this.ext,
      this.fileUri,
      compareMessage
    );
  }
}

class WebTempItem extends ScriptItem {
  override get ext(): FileExt {
    return "html";
  }

  override get field(): Field {
    return fields.definition;
  }

  override get params(): QueryParams {
    return query.pullDefinition;
  }
}

class ObjectItem extends ScriptItem {
  override readonly collapsibleState =
    vscode.TreeItemCollapsibleState.Collapsed;
  override readonly contextValue = "objectItem";
  declare parent: BaseItem;
  treeItems: ScriptItem[] = [];

  override set icon(iconPath: vscode.ThemeIcon | undefined) {
    this.iconPath = iconPath;
  }

  private createItem(label: string, iconPath: vscode.ThemeIcon | undefined) {
    const path = joinPath(this.path, label);
    return new ScriptItem(
      label,
      path,
      this.onDisk,
      this.folderUri,
      iconPath,
      this
    );
  }

  override async select() {
    const diskOnly = this.iconPath === icons.none,
      data = diskOnly ? [] : await TreeView.getObject(this.path, this.params),
      inSiebel = new Set<string>(),
      siebel = await Promise.all(
        data.map(async ({ Name: label, Script: text }) => {
          const iconPath = await TreeView.getIcon(
            label,
            text,
            this.onDisk,
            this.folderUri
          );
          inSiebel.add(label);
          return this.createItem(label, iconPath);
        })
      ),
      iconPath = diskOnly ? icons.none : icons.disk,
      disk = [...this.onDisk.keys()]
        .filter((label) => !inSiebel.has(label))
        .map((label) => this.createItem(label, iconPath));
    this.treeItems = [...siebel, ...disk].sort(({ label: a }, { label: b }) =>
      a.localeCompare(b)
    );
    this.icon = TreeView.getParentIcon(diskOnly, this.onDisk);
    TreeView.refresh(this);
  }

  async pullAll() {
    const response = await TreeView.getObject(this.path, this.params);
    await pullMissing(response, this.folderUri);
    await this.refresh();
  }

  async refresh() {
    this.onDisk = await getScriptsOnDisk(this.folderUri);
    await this.select();
  }

  async newScript() {
    await createNewScript(this.folderUri, this.parent.baseScriptItems);
    await this.refresh();
  }
}
