import * as vscode from "vscode";
import {
  query,
  fields,
  itemStates,
  ItemState,
  workspaceUri,
  selectCommand,
  revertNo,
  revealOptions,
  contextValues,
  scriptMeta,
  APPLET,
  APPLICATION,
  BUSCOMP,
  SERVICE,
  WEBTEMP,
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
  isWorkspaceEditable,
  writeFieldsType,
  writeBusCompFieldsType,
} from "./utils";

class TreeView {
  private static instance: TreeView;
  private readonly treeObject;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter();
  private readonly treeData = new Map<Type, ObjectManager | WebTempManager>([
    [SERVICE, new ObjectManager(SERVICE)],
    [BUSCOMP, new ObjectManager(BUSCOMP)],
    [APPLET, new ObjectManager(APPLET)],
    [APPLICATION, new ObjectManager(APPLICATION)],
    [WEBTEMP, new WebTempManager(WEBTEMP)],
  ]);
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  readonly refresh = (treeItem: vscode.TreeItem) =>
    this._onDidChangeTreeData.fire(treeItem);
  readonly config: RestConfig = {
    url: "",
    username: "",
    password: "",
    fileExtension: "js",
    maxPageSize: 100,
  };
  private baseURL = "";
  declare folderUri: vscode.Uri;
  activeItem: ScriptItem | WebTempItem | undefined;
  syncedItem: ScriptItem | WebTempItem | undefined;
  isSyncing = false;
  connection = "";
  workspace = "";
  type: Type = SERVICE;
  timeoutId: NodeJS.Timeout | number | undefined = undefined;
  private changeTimeoutId: NodeJS.Timeout | number | undefined = undefined;

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

  changeListener = () => {
    if (this.syncedItem) {
      this.syncedItem.state = itemStates.same;
      this.syncedItem.refresh();
      this.syncedItem = undefined;
      return;
    }
    clearTimeout(this.changeTimeoutId);
    this.changeTimeoutId = setTimeout(() => {
      if (!this.activeItem || this.activeItem.iconPath !== itemStates.same.icon)
        return;
      this.activeItemState = itemStates.differ;
      this.activeItem.refresh();
    }, 500);
  };

  select = async (treeItem: ScriptItem | WebTempItem) =>
    await treeItem.select();

  searchDisk = async (treeItem: ObjectManager | WebTempManager) =>
    await treeItem.searchDisk();

  showFilesOnDisk = async (treeItem: ObjectManager | WebTempManager) =>
    await treeItem.search();

  newService = async (treeItem: ObjectManager) => await treeItem.newService();

  pullFields = async (treeItem: ObjectItem) => await treeItem.pullFields();

  pullAll = async (treeItem: ObjectItem) => await treeItem.pullAll();

  newScript = async (treeItem: ObjectItem) => await treeItem.newScript();

  revert = async (treeItem: ScriptItem | WebTempItem) =>
    await treeItem.revert();

  compare = async (treeItem: ScriptItem | WebTempItem) =>
    await treeItem.compare();

  getTreeItem(
    treeItem:
      | ObjectManager
      | WebTempManager
      | ObjectItem
      | ScriptItem
      | WebTempItem
  ) {
    return treeItem;
  }

  getChildren(treeItem?: ObjectManager | WebTempManager | ObjectItem) {
    return treeItem ? treeItem.treeItems : [...this.treeData.values()];
  }

  getParent(
    treeItem:
      | ObjectManager
      | WebTempManager
      | ObjectItem
      | ScriptItem
      | WebTempItem
  ) {
    return treeItem.parent;
  }

  async setConfig({
    url,
    username,
    password,
    fileExtension = "js",
    maxPageSize = 100,
  }: Config) {
    this.baseURL = url;
    this.config.username = username;
    this.config.password = password;
    this.config.fileExtension = fileExtension;
    this.config.maxPageSize = maxPageSize;
    await this.setWorkspace();
  }

  async setWorkspace() {
    this.config.url = joinPath(this.baseURL, "workspace", this.workspace);
    this.folderUri = vscode.Uri.joinPath(
      workspaceUri,
      this.connection,
      this.workspace
    );
    await Promise.all(
      [...this.treeData].map(async ([type, treeItem]) => {
        treeItem.folderUri = vscode.Uri.joinPath(this.folderUri, type);
        await treeItem.search();
      })
    );
    setButtonVisibility({
      treeEdit: isWorkspaceEditable(this.workspace, this.config),
    });
    this.activeItem = undefined;
  }

  async getObject(path: string, params: QueryParams): Promise<RestResponse> {
    return await getObject("search", this.config, path, params);
  }

  async putObject(path: string, data: Payload) {
    return await putObject(this.config, path, data);
  }

  async search(searchString?: string) {
    await this.treeData.get(this.type)!.search(searchString);
  }

  async setActiveItem(type: Script | WebTemp, name: string, parent?: string) {
    this.activeItem = await this.treeData.get(type)!.getItem(name, parent);
  }

  set activeItemState(state: ItemState) {
    if (!this.activeItem || this.activeItem.state === state) return;
    this.activeItem.state = state;
    this.activeItem.refresh();
  }

  set activeObjectState(state: ItemState) {
    if (!this.activeItem) return;
    const objectItem = this.activeItem.parent;
    for (const item of objectItem.treeData.values()) {
      item.state = state;
    }
    (<ObjectItem>this.activeItem.parent).state = itemStates.same;
    this.refresh(objectItem);
  }

  async reveal() {
    await this.treeObject.reveal(this.activeItem, revealOptions);
  }
}

abstract class ManagerBase<
  T extends ObjectItem | WebTempItem
> extends vscode.TreeItem {
  override readonly collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
  readonly parent = undefined;
  readonly treeData = new Map<string, T>();
  declare label: string;
  declare folderUri: vscode.Uri;
  abstract readonly path: Type;
  protected abstract readonly searchFields: QueryParams["fields"];
  protected abstract setTreeItems(data?: RestResponse): Promise<void>;

  get treeItems() {
    return [...this.treeData.values()];
  }

  async searchDisk() {
    await searchInFiles(this.folderUri);
  }

  async search(searchString?: string) {
    clearTimeout(treeView.timeoutId);
    if (!searchString) return await this.setTreeItems();
    treeView.timeoutId = setTimeout(async () => {
      const params = {
          fields: this.searchFields,
          searchSpec: `Name LIKE '${searchString}*' AND Inactive <> 'Y'`,
        },
        data = await treeView.getObject(this.path, params);
      await this.setTreeItems(data);
    }, 300);
  }
}

class ObjectManager extends ManagerBase<ObjectItem> {
  protected readonly searchFields = fields.name;
  readonly path;
  readonly scriptPath;
  readonly defaultScripts: readonly vscode.QuickPickItem[];

  constructor(type: Script) {
    super(type);
    this.contextValue =
      type === SERVICE ? contextValues.serviceManager : contextValues.manager;
    this.path = type;
    this.scriptPath = scriptMeta[type].path;
    this.defaultScripts = scriptMeta[type].defaultScripts;
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
        const item = new ObjectItem(label, this);
        await item.setOnDisk();
        this.treeData.set(label, item);
      })
    );
    treeView.refresh(this);
  }

  async getItem(name: string, parent?: string) {
    const objectItem = this.treeData.get(parent!);
    if (!objectItem) return;
    const item = objectItem.treeData.get(name);
    if (item) return item;
    await objectItem.refresh();
    return objectItem.treeData.get(name);
  }

  async newService() {
    const newServiceData = await createNewService(
      treeView.config,
      this.folderUri
    );
    if (!newServiceData) return;
    const [serviceName, fileUri] = newServiceData;
    await this.setTreeItems();
    await this.treeData.get(serviceName)!.refresh();
    await openFile(fileUri);
    await treeView.reveal();
  }
}

class WebTempManager extends ManagerBase<WebTempItem> {
  protected readonly searchFields = query.pullDefinition.fields;
  readonly path;
  declare onDisk: OnDisk;

  constructor(type: WebTemp) {
    super(type);
    this.contextValue = contextValues.manager;
    this.path = type;
  }

  protected async setTreeItems(data?: RestResponse) {
    this.onDisk = await getWebTempsOnDisk(this.folderUri);
    const diskOnly = !data,
      source = diskOnly
        ? await Promise.all(
            [...this.onDisk.keys()].map(async (Name) => {
              const path = joinPath(this.path, Name),
                data = await treeView.getObject(path, query.pullDefinition),
                Definition = data[0]?.Definition;
              return { Name, Definition };
            })
          )
        : data,
      state = diskOnly ? itemStates.offline : itemStates.online;
    this.iconPath = state.icon;
    this.tooltip = state.tooltip;
    this.treeData.clear();
    await Promise.all(
      source.map(async ({ Name: label, Definition: text }) => {
        const item = new WebTempItem(label, this);
        await item.checkDifference(text);
        this.treeData.set(label, item);
      })
    );
    if (
      treeView.activeItem &&
      treeView.activeItem.parent.path === this.path &&
      treeView.activeItem.label === this.label
    ) {
      treeView.activeItem = this.treeData.get(treeView.activeItem.label);
    }
    treeView.refresh(this);
  }

  async getItem(name: string) {
    return this.treeData.get(name);
  }
}

class ObjectItem extends vscode.TreeItem {
  override readonly collapsibleState =
    vscode.TreeItemCollapsibleState.Collapsed;
  declare label: string;
  declare onDisk: OnDisk;
  parent: ObjectManager;
  treeData = new Map<string, ScriptItem>();
  isDifference = false;

  constructor(label: string, parent: ObjectManager) {
    super(label);
    this.parent = parent;
    this.contextValue =
      parent.path === BUSCOMP ? contextValues.buscomp : contextValues.object;
  }

  get treeItems() {
    return [...this.treeData.values()];
  }

  get path() {
    return joinPath(this.parent.path, this.label, this.parent.scriptPath);
  }

  get folderUri() {
    return vscode.Uri.joinPath(this.parent.folderUri, this.label);
  }

  get fieldPath() {
    return joinPath(this.parent.path, this.label, "Field");
  }

  set state(state: ItemState) {
    this.iconPath = state.icon;
    this.tooltip = state.tooltip;
  }

  setState() {
    if (this.onDisk.size === 0) {
      this.state = itemStates.siebel;
      return;
    }
    for (const item of this.treeItems) {
      if (
        item.iconPath !== itemStates.differ.icon &&
        item.iconPath !== itemStates.disk.icon
      )
        continue;
      this.state = itemStates.differ;
      return;
    }
    this.state = itemStates.same;
  }

  async setOnDisk() {
    this.onDisk = await getScriptsOnDisk(this.folderUri);
    this.setState();
  }

  async select() {
    this.treeData.clear();
    const data = await treeView.getObject(this.path, query.pullScripts),
      inSiebel = new Set<string>(),
      siebelItems = await Promise.all(
        data.map(async ({ Name: label, Script: text }) => {
          const item = new ScriptItem(label, this);
          await item.checkDifference(text);
          inSiebel.add(label);
          return item;
        })
      ),
      diskItems = [];
    for (const label of this.onDisk.keys()) {
      if (inSiebel.has(label)) continue;
      const item = new ScriptItem(label, this);
      item.state = itemStates.disk;
      diskItems.push(item);
    }
    for (const item of [...siebelItems, ...diskItems].sort(
      ({ label: a }, { label: b }) => a.localeCompare(b)
    )) {
      this.treeData.set(item.label, item);
    }
    this.setState();
    if (
      treeView.activeItem &&
      treeView.activeItem.parent.path === this.path &&
      treeView.activeItem.parent.label === this.label
    ) {
      treeView.activeItem = this.treeData.get(treeView.activeItem.label);
    }
    treeView.refresh(this);
  }

  async pullAll() {
    const response = await treeView.getObject(this.path, query.pullScripts);
    await Promise.all(
      response.map(async ({ Name: label, Script: text }) => {
        if (this.onDisk.has(label) || !text) return;
        const fileUri = getFileUri(
          this.folderUri,
          label,
          treeView.config.fileExtension
        );
        await writeFile(fileUri, text);
      })
    );
    await this.refresh();
  }

  async refresh() {
    await this.setOnDisk();
    await this.select();
  }

  async newScript() {
    const fileUri = await createNewScript(
      this.folderUri,
      this.parent.path,
      this.label,
      treeView.config.fileExtension
    );
    if (!fileUri) return;
    await this.refresh();
    await openFile(fileUri);
    await treeView.reveal();
  }

  async pullFields() {
    const response = await treeView.getObject(this.fieldPath, query.pullFields);
    if (response.length === 0) return;
    await writeFieldsType(treeView.connection, this.label, response);
    await writeBusCompFieldsType(treeView.connection);
  }
}

abstract class ChildItem<
  T extends ObjectItem | WebTempManager
> extends vscode.TreeItem {
  override readonly collapsibleState = vscode.TreeItemCollapsibleState.None;
  declare label: string;
  parent;
  abstract readonly field: Field;
  abstract readonly params: QueryParams;
  abstract get ext(): FileExt;
  abstract refresh(): void;

  constructor(label: string, parent: T) {
    super(label);
    this.parent = parent;
    this.command = { ...selectCommand, arguments: [this] };
  }

  set state(state: ItemState) {
    this.contextValue =
      state === itemStates.same || state === itemStates.differ
        ? contextValues.child
        : undefined;
    this.iconPath = state.icon;
    this.tooltip = state.tooltip;
  }

  get path(): string {
    return joinPath(this.parent.path, this.label);
  }

  get fileUri() {
    return getFileUri(this.parent.folderUri, this.label, this.ext);
  }

  async checkDifference(text: string | undefined) {
    if (!this.parent.onDisk.has(this.label)) {
      this.state = itemStates.siebel;
      return;
    }
    const fileContent = await readFile(this.fileUri);
    this.state = fileContent === text ? itemStates.same : itemStates.differ;
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
      this.parent.onDisk.set(this.label, this.ext);
      this.state = itemStates.same;
      this.refresh();
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
    treeView.syncedItem = <ScriptItem | WebTempItem>this;
    treeView.isSyncing = true;
    await writeFile(this.fileUri, content);
  }

  async compare() {
    const response = await treeView.getObject(this.path, this.params),
      compareMessage = `Comparison of ${this.label} in Siebel and on disk`,
      content = response[0]?.[this.field];
    if (content === undefined) return;
    this.state = await compareObjects(
      content,
      this.ext,
      this.fileUri,
      compareMessage
    );
    this.refresh();
  }
}

class ScriptItem extends ChildItem<ObjectItem> {
  readonly field = fields.script;
  readonly params = query.pullScript;

  get ext(): FileExt {
    return this.parent.onDisk.get(this.label) ?? treeView.config.fileExtension;
  }

  refresh() {
    this.parent.setState();
    treeView.refresh(this.parent);
  }
}

class WebTempItem extends ChildItem<WebTempManager> {
  readonly field = fields.definition;
  readonly params = query.pullDefinition;

  get ext(): FileExt {
    return "html";
  }

  refresh() {
    treeView.refresh(this);
  }
}

export const treeView = TreeView.getInstance();
