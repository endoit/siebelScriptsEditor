import * as vscode from "vscode";
import {
  metadata,
  baseConfig,
  query,
  fields,
  paths,
  projectOptions,
  projectInput,
  serviceInput,
  baseScripts,
  icons,
  tooltips,
  selectCommand,
} from "./constants";
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
  getObject,
  createFolder,
} from "./utils";
import { settings } from "./settings";
import { create } from "axios";

export const selectTreeItem = async (treeItem: ScriptItem | WebTempItem) =>
  await treeItem.select();
export const showFilesOnDisk = async (treeItem: BaseItem | BaseItemWebTemp) =>
  await treeItem.search();
export const newService = async (treeItem: BaseItem) =>
  await treeItem.newService();
export const pullAllTree = async (treeItem: ObjectItem) =>
  await treeItem.pullAll();
export const refreshTree = async (treeItem: ObjectItem) =>
  await treeItem.refresh();
export const newScriptTree = async (treeItem: ObjectItem) =>
  await treeItem.newScript();
export const compareTree = async (treeItem: ScriptItem | WebTempItem) =>
  await treeItem.compare();

class TreeView {
  private static instance: TreeView;
  private readonly restApi = create(baseConfig);
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  private readonly treeData = new Map([
    ["service", new BaseItem("service")],
    ["buscomp", new BaseItem("buscomp")],
    ["applet", new BaseItem("applet")],
    ["application", new BaseItem("application")],
    ["webtemp", new BaseItemWebTemp()],
  ]);
  readonly treeObject;
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  readonly refresh = (
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) => this._onDidChangeTreeData.fire(treeItem);
  timeoutId: NodeJS.Timeout | number | null = null;
  private declare baseURL: string;
  declare focused: ScriptItem | WebTempItem;

  private constructor() {
    this.treeObject = vscode.window.createTreeView("objectsView", {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    this.treeObject.onDidExpandElement(async ({ element }) => {
      if (element instanceof ObjectItem) await element.select();
    });
  }

  static getInstance() {
    TreeView.instance ??= new TreeView();
    return TreeView.instance;
  }

  private get treeItems() {
    return [...this.treeData.values()];
  }

  async setWorkspace(connection: string, workspace: string) {
    this.restApi.defaults.baseURL = joinPath(
      this.baseURL,
      "workspace",
      workspace
    );
    for (const [type, treeItem] of this.treeData) {
      treeItem.folderUri = vscode.Uri.joinPath(
        workspaceUri,
        connection,
        workspace,
        type
      );
      await treeItem.search();
    }
  }

  async setConfig(
    { url, username, password }: RestConfig,
    connection: string,
    workspace: string
  ) {
    this.baseURL = url;
    this.restApi.defaults.auth = { username, password };
    this.restApi.defaults.params.PageSize = settings.maxPageSize;
    await this.setWorkspace(connection, workspace);
  }

  getTreeItem(
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) {
    return treeItem;
  }

  getChildren(treeItem?: BaseItem | BaseItemWebTemp | ObjectItem) {
    return treeItem ? treeItem.treeItems : this.treeItems;
  }

  getParent(
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) {
    return treeItem.parent;
  }

  async search(type: Type, searchString?: string) {
    await this.treeData.get(type)?.search(searchString);
  }

  async getObject(path: string, params: QueryParams): Promise<RestResponse> {
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

  async putObject(path: string, data: Payload) {
    try {
      await this.restApi.put(path, data);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Error using the Siebel REST API: ${
          err.response?.data?.ERROR ?? err.message
        }`
      );
      return false;
    }
  }

  getParentIcon(diskOnly: boolean, onDisk: OnDisk) {
    return diskOnly
      ? icons.none
      : onDisk.size === 0
      ? icons.siebel
      : icons.same;
  }

  async getIcon(
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

  setTreeItemIconToSame(type: Type, name: string, folderUri: vscode.Uri) {
    this.treeData.get(type)?.setTreeItemIconToSame(name, folderUri);
  }
}

class BaseItem extends vscode.TreeItem {
  protected readonly parentSegment;
  protected readonly childSegment;
  protected readonly searchFields: QueryParams["fields"] = fields.name;
  readonly baseScriptItems: readonly vscode.QuickPickItem[];
  readonly parent: undefined;
  override collapsibleState: vscode.TreeItemCollapsibleState =
    vscode.TreeItemCollapsibleState.Expanded;
  declare folderUri: vscode.Uri;
  declare readonly label: string;
  readonly treeData = new Map<string, ObjectItem | WebTempItem>();

  constructor(type: Type) {
    super(metadata[type].parent);
    this.contextValue = type;
    this.parentSegment = metadata[type].parent;
    this.childSegment = metadata[type].child;
    this.baseScriptItems = metadata[type].baseScriptItems;
  }

  get treeItems() {
    return [...this.treeData.values()];
  }

  protected resetTreeData(items: (ObjectItem | WebTempItem)[]) {
    this.treeData.clear();
    for (const treeItem of items) {
      this.treeData.set(treeItem.folderUri.path, treeItem);
    }
    treeView.refresh(this);
  }

  protected async setTreeItems(data?: RestResponse) {
    const diskOnly = !data,
      source = diskOnly ? await getScriptParentsOnDisk(this.folderUri) : data;
    this.iconPath = diskOnly ? icons.none : icons.online;
    this.tooltip = tooltips.get(this.iconPath);
    const items = await Promise.all(
      source.map(async ({ Name: label }) => {
        const path = joinPath(this.parentSegment, label, this.childSegment),
          folderUri = vscode.Uri.joinPath(this.folderUri, label),
          onDisk = await getScriptsOnDisk(folderUri),
          iconPath = treeView.getParentIcon(diskOnly, onDisk);
        return new ObjectItem(label, path, onDisk, folderUri, iconPath, this);
      })
    );
    this.resetTreeData(items);
  }

  private getParams = (searchString: string) => ({
    fields: this.searchFields,
    searchSpec: `Name LIKE '${searchString}*'`,
  });

  async search(searchString?: string) {
    if (treeView.timeoutId) clearTimeout(treeView.timeoutId);
    if (!searchString) return await this.setTreeItems();
    treeView.timeoutId = setTimeout(async () => {
      const params = this.getParams(searchString),
        data = await treeView.getObject(this.parentSegment, params);
      await this.setTreeItems(data);
      treeView.timeoutId = null;
    }, 300);
  }

  async newService() {
    const searchString = await vscode.window.showInputBox(projectInput);
    if (!searchString) return;
    const params = this.getParams(searchString),
      projectResponse = await treeView.getObject("Project", params),
      items = projectResponse.map(({ Name }) => ({ label: Name }));
    if (items.length === 0)
      return vscode.window.showErrorMessage(
        `No project name starts with the specified string "${searchString}"!`
      );
    const project = await vscode.window.showQuickPick(items, projectOptions);
    if (!project) return;
    const serviceName = await vscode.window.showInputBox(serviceInput),
      serviceNameTrimmed = serviceName && serviceName.trim();
    if (!serviceNameTrimmed) return;
    const path = joinPath(this.parentSegment, serviceNameTrimmed),
      serviceResponse = await treeView.getObject(path, query.testConnection),
      isService = serviceResponse.length !== 0;
    if (isService)
      return vscode.window.showErrorMessage(
        `Busines service ${serviceNameTrimmed} already exists!`
      );
    const payload = { Name: serviceNameTrimmed, "Project Name": project.label },
      isSuccess = await treeView.putObject(path, payload);
    if (!isSuccess) return;
    const folderUri = vscode.Uri.joinPath(this.folderUri, serviceNameTrimmed),
      fileUri = getFileUri(
        folderUri,
        "Service_PreInvokeMethod",
        settings.fileExtension
      );
    await writeFile(fileUri, baseScripts.Service_PreInvokeMethod);
    await this.search();
  }

  setTreeItemIconToSame(name: string, folderUri: vscode.Uri) {
    const treeItem = (<Map<string, ObjectItem>>this.treeData)
      .get(folderUri.path)
      ?.treeData.get(name);
    if (!treeItem || !treeItem.iconPath) return;
    treeItem.iconPath = icons.same;
    treeView.refresh(treeItem);
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
    const items = await Promise.all(
      source.map(async ({ Name: label, Definition: text }) => {
        const path = joinPath(this.parentSegment, label),
          iconPath = await treeView.getIcon(
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
    this.resetTreeData(items);
  }

  override setTreeItemIconToSame(name: string) {
    const treeItem = this.treeData.get(name);
    if (!treeItem || !treeItem.iconPath) return;
    treeItem.iconPath = icons.same;
    treeView.refresh(treeItem);
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
    if (new.target !== ObjectItem)
      this.command = { ...selectCommand, arguments: [this] };
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
      const data = await treeView.getObject(this.path, this.params);
      if (data.length === 0) return;
      const { [this.field]: text } = data[0];
      if (text === undefined) return;
      await writeFile(this.fileUri, text);
      this.onDisk.set(this.label, this.ext);
      this.icon = icons.same;
      if (this.parent) this.parent.iconPath = icons.same;
      treeView.refresh(this.parent ? this.parent : this);
    }
    await openFile(this.fileUri);
  }

  async compare() {
    const response = await treeView.getObject(this.path, this.params),
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
  treeData = new Map<string, ScriptItem>();

  get treeItems() {
    return [...this.treeData.values()];
  }

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

  private resetTreeData(items: ScriptItem[]) {
    this.treeData.clear();
    for (const treeItem of items) {
      this.treeData.set(treeItem.label, treeItem);
    }
    treeView.refresh(this);
  }

  override async select() {
    const diskOnly = this.iconPath === icons.none,
      data = diskOnly ? [] : await treeView.getObject(this.path, this.params),
      inSiebel = new Set<string>(),
      siebel = await Promise.all(
        data.map(async ({ Name: label, Script: text }) => {
          const iconPath = await treeView.getIcon(
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
    const items = [...siebel, ...disk].sort(({ label: a }, { label: b }) =>
      a.localeCompare(b)
    );
    this.icon = treeView.getParentIcon(diskOnly, this.onDisk);
    this.resetTreeData(items);
  }

  async pullAll() {
    const response = await treeView.getObject(this.path, this.params);
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

export const treeView = TreeView.getInstance();
