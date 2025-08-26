import * as vscode from "vscode";
import {
  metadata,
  query,
  fields,
  itemStates,
  ItemStates,
  workspaceUri,
  selectCommand,
  revertNo,
} from "./constants";
import {
  getScriptsOnDisk,
  getWebTempsOnDisk,
  joinPath,
  openFile,
  writeFile,
  readFile,
  getScriptParentsOnDisk,
  getFileUri,
  compareObjects,
  getObject,
  putObject,
  searchInFiles,
  setButtonVisibility,
  createNewScript,
  createNewService,
} from "./utils";

class TreeView {
  private static instance: TreeView;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  private readonly treeData = new Map<Type, BaseItem | BaseItemWebTemp>([
    ["service", new BaseItem("service")],
    ["buscomp", new BaseItem("buscomp")],
    ["applet", new BaseItem("applet")],
    ["application", new BaseItem("application")],
    ["webtemp", new BaseItemWebTemp()],
  ]);
  private readonly treeObject;
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  readonly refresh = (
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) => this._onDidChangeTreeData.fire(treeItem);
  readonly config: RestConfig = {
    url: "",
    username: "",
    password: "",
    fileExtension: "js",
    maxPageSize: 100,
  };
  private declare baseURL: string;
  activeItem: ScriptItem | WebTempItem | undefined;
  changeListener: vscode.Disposable | undefined;
  isSyncing = false;
  connection = "";
  workspace = "";
  type: Type = "service";
  timeoutId: NodeJS.Timeout | number | null = null;

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

  select = async (treeItem: ScriptItem | WebTempItem) =>
    await treeItem.select();

  searchDisk = async (treeItem: BaseItem | BaseItemWebTemp) =>
    await treeItem.searchDisk();

  showFilesOnDisk = async (treeItem: BaseItem | BaseItemWebTemp) =>
    await treeItem.search();

  newService = async (treeItem: BaseItem) => await treeItem.newService();

  pullAll = async (treeItem: ObjectItem) => await treeItem.pullAll();

  newScript = async (treeItem: ObjectItem) => await treeItem.newScript();

  revert = async (treeItem: ScriptItem | WebTempItem) =>
    await treeItem.revert();

  compare = async (treeItem: ScriptItem | WebTempItem) =>
    await treeItem.compare();

  getTreeItem(
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) {
    return treeItem;
  }

  getChildren(treeItem?: BaseItem | BaseItemWebTemp | ObjectItem) {
    return treeItem ? treeItem.treeItems : [...this.treeData.values()];
  }

  getParent(
    treeItem: BaseItem | BaseItemWebTemp | ObjectItem | ScriptItem | WebTempItem
  ) {
    return treeItem.parent;
  }

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
    const treeEdit = this.workspace.includes(
      `_${this.config.username.toLowerCase()}_`
    );
    setButtonVisibility({ treeEdit });
  }

  async setConfig({ url, username, password, fileExtension }: Config) {
    this.baseURL = url;
    this.config.username = username;
    this.config.password = password;
    this.config.fileExtension = fileExtension ?? "js";
    await this.setWorkspace();
  }

  async search(searchString?: string) {
    await this.treeData.get(this.type)!.search(searchString);
  }

  async getObject(path: string, params: QueryParams): Promise<RestResponse> {
    return await getObject("search", this.config, path, params);
  }

  async putObject(path: string, data: Payload) {
    return await putObject(this.config, path, data);
  }

  getParentState(onDisk: OnDisk) {
    return onDisk.size === 0 ? itemStates.siebel : itemStates.same;
  }

  async getItemState(
    label: string,
    text: string | undefined,
    onDisk: OnDisk,
    folderUri: vscode.Uri
  ) {
    if (!onDisk.has(label)) return itemStates.siebel;
    const fileUri = getFileUri(folderUri, label, onDisk.get(label)!),
      fileContent = await readFile(fileUri);
    return fileContent === text ? itemStates.same : itemStates.differ;
  }

  setActiveItem(
    type: Type,
    folderUri: vscode.Uri,
    name: string,
    parent?: string
  ) {
    const treeItem = this.treeData.get(type);
    this.activeItem =
      treeItem && treeItem.folderUri.toString() === folderUri.toString()
        ? treeItem.getItem(name, parent)
        : undefined;
    this.isSyncing = false;
    if (!this.activeItem || this.activeItem.iconPath !== itemStates.same.icon)
      return;
    this.addChangeListener();
  }

  setActiveItemState(state: ItemStates) {
    if (!this.activeItem || this.activeItem.state === state) return;
    this.activeItem.state = state;
    this.refresh(this.activeItem);
  }

  setActiveParentItemState() {
    if (!this.activeItem || this.activeItem.iconPath === itemStates.same.icon)
      return;
    const parentItem = this.activeItem.parent;
    for (const item of parentItem.treeData.values()) {
      item.state = itemStates.same;
    }
    this.refresh(parentItem);
  }

  addChangeListener() {
    this.changeListener?.dispose();
    this.changeListener = vscode.workspace.onDidChangeTextDocument(() => {
      if (this.isSyncing) {
        this.isSyncing = false;
        return;
      }
      treeView.setActiveItemState(itemStates.differ);
      this.refresh(this.activeItem!);
      this.changeListener?.dispose();
    });
  }

  async refreshBase(
    type: Type,
    objectFolderUri: vscode.Uri,
    name: string,
    parent: string
  ) {
    const baseItem = this.treeData.get(type),
      parentItem = baseItem!.treeData.get(parent);
    await parentItem?.select();
    this.setActiveItem(type, objectFolderUri, name, parent);
    console.log(this.activeItem?.label);
    await treeView.reveal();
  }

  async reveal() {
    await this.treeObject.reveal(this.activeItem, {
      select: true,
      focus: true,
    });
  }
}

class BaseItem extends vscode.TreeItem {
  protected readonly parentSegment;
  protected readonly childSegment;
  protected readonly searchFields: QueryParams["fields"] = fields.name;
  readonly defaultScripts: readonly vscode.QuickPickItem[];
  readonly parent = undefined;
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
    this.defaultScripts = metadata[type].defaultScripts;
  }

  get treeItems() {
    return [...this.treeData.values()];
  }

  protected async setTreeItems(data?: RestResponse) {
    const [source, state] = data
      ? [data, itemStates.online]
      : [await getScriptParentsOnDisk(this.folderUri), itemStates.offline];
    this.iconPath = state.icon;
    this.tooltip = state.tooltip;
    this.treeData.clear();
    await Promise.all(
      source.map(async ({ Name: label }) => {
        const path = joinPath(this.parentSegment, label, this.childSegment),
          folderUri = vscode.Uri.joinPath(this.folderUri, label),
          onDisk = await getScriptsOnDisk(folderUri),
          itemState = treeView.getParentState(onDisk),
          item = new ObjectItem(
            label,
            path,
            onDisk,
            folderUri,
            itemState,
            this
          );
        this.treeData.set(label, item);
      })
    );
    treeView.refresh(this);
  }

  private getParams = (searchString: string) => ({
    fields: this.searchFields,
    searchSpec: `Name LIKE '${searchString}*' AND Inactive <> 'Y'`,
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
    await createNewService(treeView.config, this.folderUri);
    await this.setTreeItems();
  }

  getItem(name: string, parent?: string) {
    return (<Map<string, ObjectItem>>this.treeData)
      .get(parent!)
      ?.treeData.get(name);
  }

  /*setActiveItemState(name: string, state: ItemStates, parent?: string) {
    const treeItem = this.getItem(name, parent);
    if (!treeItem || treeItem.iconPath === state.icon) return;
    treeItem.state = state;
    treeView.refresh(treeItem);
  }*/
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
        ? await Promise.all(
            [...onDisk.keys()].map(async (Name) => {
              const path = joinPath(this.parentSegment, Name),
                data = await treeView.getObject(path, query.pullDefinition),
                Definition =
                  data.length === 0 ? undefined : data[0]?.Definition;
              /*if (data.length === 0) {
        this.state = itemStates.disk;
        treeView.refresh(this.parent ? this.parent : this);
        return await openFile(this.fileUri);
      }
      if (text === undefined) return;
      if (this.iconPath === itemStates.siebel.icon) {
        await writeFile(this.fileUri, text);
        this.onDisk.set(this.label, this.ext);
      }*/
              return { Name, Definition };
            })
          )
        : data,
      state = diskOnly ? itemStates.offline : itemStates.online;
    this.iconPath = state.icon;
    this.tooltip = diskOnly ? state.tooltip : state.tooltip;
    this.treeData.clear();
    const items = await Promise.all(
      source.map(async ({ Name: label, Definition: text }) => {
        const path = joinPath(this.parentSegment, label),
          itemState = await treeView.getItemState(
            label,
            text,
            onDisk,
            this.folderUri
          ),
          item = new WebTempItem(
            label,
            path,
            onDisk,
            this.folderUri,
            itemState,
            this
          );
      })
    );
    treeView.refresh(this);
  }

  override getItem(name: string) {
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
  onDisk: OnDisk;

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
    if (new.target === ObjectItem) return;
    this.command = { ...selectCommand, arguments: [this] };
  }

  set state(state: ItemStates) {
    this.contextValue =
      state === itemStates.same || state === itemStates.differ
        ? "pullTree"
        : undefined;
    this.iconPath = state.icon;
    this.tooltip = state.tooltip;
  }

  get ext(): FileExt {
    return this.onDisk.get(this.label) ?? treeView.config.fileExtension;
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
    if (this.iconPath === itemStates.siebel.icon) {
      const data = await treeView.getObject(this.path, this.params);
      if (data.length === 0) {
        this.state = itemStates.disk;
        treeView.refresh(this);
        return await openFile(this.fileUri);
      }
      const { [this.field]: text } = data[0];
      if (text === undefined) return;
      await writeFile(this.fileUri, text);
      this.onDisk.set(this.label, this.ext);
      this.state = await treeView.getItemState(
        this.label,
        text,
        this.onDisk,
        this.folderUri
      );
      if (this.parent instanceof ObjectItem)
        this.parent.state = treeView.getParentState(this.parent.onDisk);
      treeView.refresh(this.parent);
    }
    await openFile(this.fileUri);
  }

  async revert() {
    const answer = await vscode.window.showInformationMessage(
      `Do you want to overwrite ${this.label} from Siebel?`,
      ...revertNo
    );
    if (answer !== "Revert") return;
    const response = await treeView.getObject(this.path, this.params),
      content = response[0]?.[this.field];
    if (content === undefined) return;
    treeView.isSyncing = true;
    await writeFile(this.fileUri, content);
    this.state = itemStates.same;
    treeView.refresh(this);
    if (this !== treeView.activeItem) return;
    treeView.addChangeListener();
  }

  async compare() {
    const response = await treeView.getObject(this.path, this.params),
      compareMessage = `Comparison of ${this.label} in Siebel and on disk`;
    this.state = await compareObjects(
      response,
      this.field,
      this.ext,
      this.fileUri,
      compareMessage
    );
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

  override get params() {
    return query.pullScripts;
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

  override async select() {
    const data = await treeView.getObject(this.path, this.params),
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
      disk = [...this.onDisk.keys()]
        .filter((label) => !inSiebel.has(label))
        .map((label) => this.createItem(label, itemStates.disk)),
      items = [...siebel, ...disk].sort(({ label: a }, { label: b }) =>
        a.localeCompare(b)
      );
    this.state = treeView.getParentState(this.onDisk);
    this.treeData.clear();
    for (const treeItem of items) {
      this.treeData.set(treeItem.label, treeItem);
    }
    treeView.refresh(this);
  }

  async pullAll() {
    const response = await treeView.getObject(this.path, this.params),
      onDisk = await getScriptsOnDisk(this.folderUri);
    for (const { Name: label, Script: text } of response) {
      if (onDisk.has(label) || !text) continue;
      const fileUri = getFileUri(
        this.folderUri,
        label,
        treeView.config.fileExtension
      );
      await writeFile(fileUri, text);
    }
    await this.refresh();
  }

  async refresh() {
    this.onDisk = await getScriptsOnDisk(this.folderUri);
    await this.select();
  }

  async newScript() {
    const fileUri = await createNewScript(
      this.folderUri,
      this.parent.defaultScripts,
      this.label,
      treeView.config.fileExtension
    );
    await this.refresh();
    if (fileUri) await openFile(fileUri);
  }
}

export const treeView = TreeView.getInstance();
