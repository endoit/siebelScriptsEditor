import { join } from "path";
import * as vscode from "vscode";
import {
  WEBTEMP,
  RESOURCE_URL,
  TREE_OBJECT,
  TREE_WEBTEMP,
  TREE_SCRIPT,
} from "./constants";
import {
  getServerScriptMethod,
  getServerScripts,
  getWebTemplate,
} from "./dataService";
import { writeFile, writeInfo } from "./fileRW";

//handle selection in the tree views
export const selectionChange = async (
  { selection: [selectedItem] }: vscode.TreeViewSelectionChangeEvent<TreeItem>,
  selected: Selected,
  dataObject: ScriptObject | WebTempObject,
  treeObject: TreeDataProvider,
  {
    singleFileAutoDownload,
    localFileExtension,
    defaultScriptFetching,
  }: Partial<Settings>
) => {
  if (!selectedItem) return;
  const { connection, workspace, object: type } = selected,
    { label, parent, type: treeItemType } = selectedItem,
    folderPath = `${connection}/${workspace}/${type}`,
    SHOW_DOCUMENT = true;
  let answer: Settings["defaultScriptFetching"];
  switch (treeItemType) {
    case TREE_OBJECT: {
      selected[type].name = label;
      answer =
        defaultScriptFetching !== "None - always ask"
          ? defaultScriptFetching
          : await vscode.window.showInformationMessage(
              `Do you want to get the ${label} ${RESOURCE_URL[type].obj} from Siebel?`,
              "Yes",
              "Only method names",
              "No"
            );
      dataObject = dataObject as ScriptObject;
      const methodsOnly = answer === "Only method names";
      if (answer === "Yes" || answer === "All scripts" || methodsOnly) {
        const serverScripts = await getServerScripts(selected, methodsOnly);
        const scriptNames = Object.keys(serverScripts);
        for (const [scriptName, { content, onDisk }] of Object.entries(
          serverScripts
        )) {
          dataObject[label][scriptName] = onDisk;
          if (methodsOnly) continue;
          const relativePath = `${folderPath}/${label}/${scriptName}${localFileExtension}`;
          await writeFile(content, relativePath, SHOW_DOCUMENT);
        }
        if (!methodsOnly)
          await writeInfo(selected, folderPath, scriptNames);
        treeObject.refresh(dataObject, TREE_OBJECT);
        return;
      }
    }
    case TREE_SCRIPT: {
      selected[type].name = parent!;
      selected[type as ObjectWithScript].childName = label;
      answer = singleFileAutoDownload
        ? "Yes"
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${label} ${RESOURCE_URL[type].obj} method from Siebel?`,
            "Yes",
            "No"
          );
      if (answer === "Yes") {
        dataObject = dataObject as ScriptObject;
        const scriptContent = await getServerScriptMethod(
          selected,
          type as ObjectWithScript
        );
        if (!scriptContent) return;
        dataObject[parent!][label] = true;
        const relativePath = `${folderPath}/${parent}/${label}${localFileExtension}`;
        await writeFile(scriptContent, relativePath, SHOW_DOCUMENT);
        await writeInfo(selected, folderPath, [label]);
        treeObject.refresh(dataObject, TREE_OBJECT);
      }
      return;
    }
    case TREE_WEBTEMP: {
      dataObject = dataObject as WebTempObject;
      selected[WEBTEMP].name = label;
      answer = singleFileAutoDownload
        ? "Yes"
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${label} ${RESOURCE_URL[WEBTEMP].obj} definition from Siebel?`,
            "Yes",
            "No"
          );
      if (answer === "Yes") {
        const definition = await getWebTemplate(selected);
        if (definition === undefined) return;
        dataObject[label] = true;
        const relativePath = `${folderPath}/${label}.html`;
        await writeFile(definition, relativePath, SHOW_DOCUMENT);
        await writeInfo(selected, folderPath, [label]);
        treeObject.refresh(dataObject, TREE_WEBTEMP);
      }
      return;
    }
  }
};

//creates tree data
export class TreeDataProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: TreeItem[];

  constructor(dataObject: ScriptObject, type: TreeObject);
  constructor(dataObject: WebTempObject, type: TreeWebtemp);
  constructor(
    dataObject: ScriptObject | WebTempObject,
    type: TreeObject | TreeWebtemp
  ) {
    this.data = this.createTreeItems(dataObject, type);
  }

  createTreeItems = (
    dataObject: ScriptObject | WebTempObject,
    type: TreeObject | TreeWebtemp
  ) =>
    type === TREE_OBJECT
      ? Object.entries(dataObject).map(
          ([name, scripts]) =>
            new TreeItem(
              name,
              TREE_OBJECT,
              Object.values(scripts).some((x) => x),
              scripts
            )
        )
      : Object.entries(dataObject).map(
          ([name, onDisk]) => new TreeItem(name, TREE_WEBTEMP, onDisk)
        );

  getTreeItem(element: TreeItem) {
    return element;
  }
  getChildren(element: TreeItem) {
    return element === undefined
      ? this.data
      : Object.entries(element.scripts!).map(
          ([scriptName, onDisk]) =>
            new TreeItem(scriptName, TREE_SCRIPT, onDisk, element.label)
        );
  }

  refresh(dataObject: ScriptObject, type: TreeObject): void;
  refresh(dataObject: WebTempObject, type: TreeWebtemp): void;
  refresh(
    dataObject: ScriptObject | WebTempObject,
    type: TreeObject | TreeWebtemp
  ) {
    this.data = this.createTreeItems(dataObject, type);
    this._onDidChangeTreeData.fire(null);
  }

  clear() {
    this.data = [];
    this._onDidChangeTreeData.fire(null);
  }
}

//creates the tree items for tree data
export class TreeItem extends vscode.TreeItem {
  label: string;
  type: TreeItemType;
  scripts?: Scripts;
  parent?: string;

  constructor(
    label: string,
    type: TreeObject,
    onDisk: boolean,
    scriptsOrParent: Scripts
  );
  constructor(
    label: string,
    type: TreeScript,
    onDisk: boolean,
    scriptsOrParent: string
  );
  constructor(label: string, type: TreeWebtemp, onDisk: boolean);
  constructor(
    label: string,
    type: TreeItemType,
    onDisk: boolean,
    scriptsOrParent?: Scripts | string
  ) {
    super(
      label,
      type === TREE_OBJECT
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.label = label;
    this.type = type;
    if (
      type === TREE_OBJECT &&
      scriptsOrParent &&
      typeof scriptsOrParent !== "string"
    )
      this.scripts = scriptsOrParent;
    if (
      type === TREE_SCRIPT &&
      scriptsOrParent &&
      typeof scriptsOrParent === "string"
    )
      this.parent = scriptsOrParent;
    if (onDisk)
      this.iconPath = {
        light: join(__filename, "..", "..", "media", "checkmark.png"),
        dark: join(__filename, "..", "..", "media", "checkmark.png"),
      };
  }
}
