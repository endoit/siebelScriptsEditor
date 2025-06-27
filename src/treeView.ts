import * as vscode from "vscode";
import {
  metadata,
  query,
  fields,
  projectOptions,
  projectInput,
  serviceInput,
  baseScripts,
  itemStates,
  ItemStates,
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
  putObject,
  settings,
  createNewService,
  searchInFiles,
} from "./utils";

export const selectTreeItem = async (treeItem: ScriptItem | WebTempItem) =>
  await treeItem.select();
export const searchTree = async (treeItem: BaseItem | BaseItemWebTemp) =>
  await treeItem.searchDisk();
export const showFilesOnDisk = async (treeItem: BaseItem | BaseItemWebTemp) =>
  await treeItem.search();
export const newServiceTree = async (treeItem: BaseItem) =>
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
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  private readonly treeData = new Map([
    ["service", new BaseItem("service")],
    ["buscomp", new BaseItem("buscomp")],
    ["applet", new BaseItem("applet")],
    ["application", new BaseItem("application")],
    ["webtemp", new BaseItemWebTemp()],
  ]);
  readonly config = { url: "", username: "", password: "" };
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  readonly refresh = (
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) => this._onDidChangeTreeData.fire(treeItem);
  private declare baseURL: string;
  connection = "";
  workspace = "";
  type: Type = "service";
  timeoutId: NodeJS.Timeout | number | null = null;

  private constructor() {
    const treeObject = vscode.window.createTreeView("objectsView", {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    treeObject.onDidExpandElement(async ({ element }) => {
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

  isFocused = (connection: string, workspace: string, type: Type) =>
    this.connection === connection &&
    this.workspace === workspace &&
    this.type === type;

  async setWorkspace() {
    this.config.url = joinPath(this.baseURL, "workspace", this.workspace);
    for (const [type, treeItem] of this.treeData) {
      treeItem.folderUri = vscode.Uri.joinPath(
        workspaceUri,
        this.connection,
        this.workspace,
        type
      );
      await treeItem.search();
    }
  }

  async setConfig(
    { url, username, password }: RestConfig
  ) {
    this.baseURL = url;
    this.config.username = username;
    this.config.password = password;
    await this.setWorkspace();
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

  async search(searchString?: string) {
    await this.treeData.get(this.type)?.search(searchString);
  }

  async getObject(path: string, params: QueryParams): Promise<RestResponse> {
    return await getObject("search", this.config, path, params);
  }

  async putObject(path: string, data: Payload) {
    return await putObject(this.config, path, data);
  }

  getParentState(diskOnly: boolean, onDisk: OnDisk) {
    return diskOnly
      ? itemStates.none
      : onDisk.size === 0
      ? itemStates.siebel
      : itemStates.same;
    /*onDisk.size === 0
      ? itemStates.siebel
      : itemStates.same;*/
  }

  async getItemState(
    label: string,
    text: string | undefined,
    onDisk: OnDisk,
    folderUri: vscode.Uri
  ) {
    if (text === undefined) return itemStates.none;
    if (!onDisk.has(label)) return itemStates.siebel;
    const fileUri = getFileUri(folderUri, label, onDisk.get(label)!),
      fileContent = await readFile(fileUri);
    return fileContent === text ? itemStates.same : itemStates.differ;
  }

  setItemState(
    type: Type,
    name: string,
    folderUri: vscode.Uri,
    state: ItemStates,
    parent?: string
  ) {
    if (this.treeData.get(type)!.folderUri.path !== folderUri.path) return;
    this.treeData.get(type)?.setItemState(name, state, parent);
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
      this.treeData.set(treeItem.label, treeItem);
    }
    treeView.refresh(this);
  }

  protected async setTreeItems(data?: RestResponse) {
    const diskOnly = !data,
      source = diskOnly ? await getScriptParentsOnDisk(this.folderUri) : data,
      state = diskOnly ? itemStates.offline : itemStates.online;
    this.iconPath = state.icon;
    this.tooltip = diskOnly
      ? state.tooltip
      : `${state.tooltip}${new Date().toLocaleString()}`;
    const items = await Promise.all(
      source.map(async ({ Name: label }) => {
        const path = joinPath(this.parentSegment, label, this.childSegment),
          folderUri = vscode.Uri.joinPath(this.folderUri, label),
          onDisk = await getScriptsOnDisk(folderUri),
          itemState = treeView.getParentState(diskOnly, onDisk);
        return new ObjectItem(label, path, onDisk, folderUri, itemState, this);
      })
    );
    this.resetTreeData(items);
  }

  private getParams = (searchString: string) => ({
    fields: this.searchFields,
    searchSpec: `Name LIKE '${searchString}*'`,
  });

  async searchDisk() {
    await searchInFiles(this.folderUri);
  }

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
    await createNewService(treeView.config, this.folderUri); //átgondolni a frissitést
  }

  protected getTreeItem(name: string, parent?: string) {
    return (<Map<string, ObjectItem>>this.treeData)
      .get(parent!)
      ?.treeData.get(name);
  }

  setItemState(name: string, state: ItemStates, parent?: string) {
    const treeItem = this.getTreeItem(name, parent);
    if (!treeItem || treeItem.iconPath === state.icon) return;
    treeItem.state = state;
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
        : data,
      state = diskOnly ? itemStates.offline : itemStates.online;
    this.iconPath = state.icon;
    this.tooltip = diskOnly
      ? state.tooltip
      : `${state.tooltip}${new Date().toLocaleString()}`;
    const items = await Promise.all(
      source.map(async ({ Name: label, Definition: text }) => {
        const path = joinPath(this.parentSegment, label),
          itemState = await treeView.getItemState(
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
          itemState,
          this
        );
      })
    );
    this.resetTreeData(items);
  }

  protected override getTreeItem(name: string) {
    return (<Map<string, WebTempItem>>this.treeData).get(name);
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
    state: ItemStates,
    parent: BaseItem | BaseItemWebTemp | ObjectItem
  ) {
    super(label);
    this.path = path;
    this.onDisk = onDisk;
    this.folderUri = folderUri;
    this.state = state;
    this.parent = parent;
    if (new.target !== ObjectItem)
      this.command = { ...selectCommand, arguments: [this] };
  }

  set state(state: ItemStates) {
    this.contextValue =
      state === itemStates.same || state === itemStates.differ
        ? "compareTree"
        : undefined;
    this.iconPath = state.icon;
    this.tooltip =
      state === itemStates.same || state === itemStates.differ
        ? `${state.tooltip}${new Date().toLocaleString()}`
        : state.tooltip;
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
    //kitalálni rendesen és javítani
    if (this.iconPath === itemStates.disk.icon)
      return await openFile(this.fileUri);

    const data = await treeView.getObject(this.path, this.params);
    if (data.length === 0) {
      this.state = itemStates.disk;
      treeView.refresh(this.parent ? this.parent : this);
      return await openFile(this.fileUri);
    }
    const { [this.field]: text } = data[0];
    if (text === undefined) return;
    if (this.iconPath === itemStates.siebel.icon) {
      await writeFile(this.fileUri, text);
      this.onDisk.set(this.label, this.ext);
    }
    this.state = await treeView.getItemState(
      this.label,
      text,
      this.onDisk,
      this.folderUri
    );

    if (this.parent instanceof ObjectItem) {
      this.parent.state = treeView.getParentState(
        this.parent.iconPath === itemStates.none.icon,
        this.parent.onDisk
      );
      /* this.parent.state = await treeView.getItemState(
          this.label,
          text,
          this.onDisk,
          this.folderUri
        ); //itemStates.same;*/
    }

    treeView.refresh(this.parent ? this.parent : this);
    await openFile(this.fileUri);
  }

  async compare() {
    const response = await treeView.getObject(this.path, this.params),
      compareMessage = `Comparison of ${this.label} in Siebel and on disk`,
      differ = await compareObjects(
        response,
        this.field,
        this.ext,
        this.fileUri,
        compareMessage
      );
    this.state = differ ? itemStates.differ : itemStates.same;
    treeView.refresh(this);
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

  override set state(state: ItemStates) {
    this.iconPath = state.icon;
    this.tooltip =
      state === itemStates.same
        ? `${state.tooltip}${new Date().toLocaleString()}`
        : state.tooltip;
  }

  private createItem(label: string, state: ItemStates) {
    const path = joinPath(this.path, label);
    return new ScriptItem(
      label,
      path,
      this.onDisk,
      this.folderUri,
      state,
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
    const diskOnly = this.iconPath === itemStates.none.icon,
      data = diskOnly ? [] : await treeView.getObject(this.path, this.params),
      inSiebel = new Set<string>(),
      siebel = await Promise.all(
        data.map(async ({ Name: label, Script: text }) => {
          const iconPath = await treeView.getItemState(
            label,
            text,
            this.onDisk,
            this.folderUri
          );
          inSiebel.add(label);
          return this.createItem(label, iconPath);
        })
      ),
      iconPath = diskOnly ? itemStates.none : itemStates.disk,
      disk = [...this.onDisk.keys()]
        .filter((label) => !inSiebel.has(label))
        .map((label) => this.createItem(label, iconPath));
    const items = [...siebel, ...disk].sort(({ label: a }, { label: b }) =>
      a.localeCompare(b)
    );
    this.state = treeView.getParentState(diskOnly, this.onDisk);
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
    await this.refresh(); //frissitést átgondolni
  }
}

export const treeView = TreeView.getInstance();
