import { join } from "path";
import * as vscode from "vscode";
import { WEBTEMP, RESOURCE_URL, TREE_OBJECT } from "./constants";
import {
  getServerScriptMethod,
  getServerScripts,
  getWebTemplate,
} from "./dataService";
import { writeFile, writeInfo } from "./fileRW";

export type TreeItem = TreeItemObject | TreeItemScript | TreeItemWebtemp;

//Icon paths for the checkmark in the tree views
const checkmarkIconPath = {
  light: join(__filename, "..", "..", "media", "checkmark.png"),
  dark: join(__filename, "..", "..", "media", "checkmark.png"),
};

//handle selection in the tree views
export const selectionChange = async (
  { selection: [selectedItem] }: vscode.TreeViewSelectionChangeEvent<TreeItem>,
  selected: Selected,
  treeObject: TreeDataProvider,
  {
    singleFileAutoDownload,
    localFileExtension,
    defaultScriptFetching,
  }: Partial<Settings>
) => {
  if (!selectedItem) return;
  const { connection, workspace, object: type } = selected,
    { label } = selectedItem,
    folderPath = `${connection}/${workspace}/${type}`,
    SHOW_DOCUMENT = true;
  switch (true) {
    case selectedItem instanceof TreeItemObject: {
      selected[type].name = label;
      const answer =
        defaultScriptFetching !== "None - always ask"
          ? defaultScriptFetching
          : await vscode.window.showInformationMessage(
              `Do you want to get the ${label} ${RESOURCE_URL[type].obj} from Siebel?`,
              "Yes",
              "Only method names",
              "No"
            );
      const methodsOnly = answer === "Only method names";
      if (!(answer === "Yes" || answer === "All scripts" || methodsOnly))
        return;
      const serverScripts = await getServerScripts(selected, methodsOnly),
        scriptNames = Object.keys(serverScripts);
      for (const [scriptName, { content, onDisk }] of Object.entries(
        serverScripts
      )) {
        (treeObject.dataObject as ScriptObject)[label][scriptName] = onDisk;
        if (methodsOnly) continue;
        const relativePath = `${folderPath}/${label}/${scriptName}${localFileExtension}`;
        await writeFile(content, relativePath, SHOW_DOCUMENT);
      }
      if (!methodsOnly) await writeInfo(selected, folderPath, scriptNames);
      treeObject.refresh();
      return;
    }
    case selectedItem instanceof TreeItemScript: {
      const { parent } = selectedItem;
      selected[type].name = parent;
      (selected[type] as SelectedScript).childName = label;
      const answer = singleFileAutoDownload
        ? "Yes"
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${label} ${RESOURCE_URL[type].obj} method from Siebel?`,
            "Yes",
            "No"
          );
      if (answer !== "Yes") return;
      const scriptContent = await getServerScriptMethod(
        selected,
        type as ObjectWithScript
      );
      if (!scriptContent) return;
      (treeObject.dataObject as ScriptObject)[parent][label] = true;
      const relativePath = `${folderPath}/${parent}/${label}${localFileExtension}`;
      await writeFile(scriptContent, relativePath, SHOW_DOCUMENT);
      await writeInfo(selected, folderPath, [label]);
      treeObject.refresh();
      return;
    }
    case selectedItem instanceof TreeItemWebtemp: {
      selected[WEBTEMP].name = label;
      const answer = singleFileAutoDownload
        ? "Yes"
        : await vscode.window.showInformationMessage(
            `Do you want to get the ${label} ${RESOURCE_URL[WEBTEMP].obj} definition from Siebel?`,
            "Yes",
            "No"
          );
      if (answer !== "Yes") return;
      const definition = await getWebTemplate(selected);
      if (definition === undefined) return;
      treeObject.dataObject[label] = true;
      const relativePath = `${folderPath}/${label}.html`;
      await writeFile(definition, relativePath, SHOW_DOCUMENT);
      await writeInfo(selected, folderPath, [label]);
      treeObject.refresh();
      return;
    }
  }
};

//creates tree data
export class TreeDataProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  private data: (TreeItemObject | TreeItemWebtemp)[];
  private type: TreeObject | TreeWebtemp;
  dataObject: ScriptObject | WebTempObject;

  constructor(dataObject: ScriptObject, type: TreeObject);
  constructor(dataObject: WebTempObject, type: TreeWebtemp);
  constructor(
    dataObject: ScriptObject | WebTempObject,
    type: TreeObject | TreeWebtemp
  ) {
    this.type = type;
    this.dataObject = dataObject;
    this.data = this.createTreeItems();
  }

  createTreeItems = () =>
    this.type === TREE_OBJECT
      ? Object.entries(this.dataObject).map(
          ([name, scripts]) => new TreeItemObject(name, scripts)
        )
      : Object.entries(this.dataObject).map(
          ([name, onDisk]) => new TreeItemWebtemp(name, onDisk)
        );

  getTreeItem = (element: TreeItem) => element;

  getChildren = (element: TreeItem) =>
    element instanceof TreeItemObject
      ? Object.entries(element.scripts).map(
          ([scriptName, onDisk]) =>
            new TreeItemScript(scriptName, element.label, onDisk)
        )
      : this.data;

  refresh() {
    this.data = this.createTreeItems();
    this._onDidChangeTreeData.fire(null);
  }

  clear() {
    this.dataObject = {};
    this.data = [];
    this._onDidChangeTreeData.fire(null);
  }
}

//creates the different tree items for tree views
class TreeItemObject extends vscode.TreeItem {
  label: string;
  scripts: Scripts;
  constructor(label: string, scripts: Scripts) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.label = label;
    this.scripts = scripts;
    if (Object.values(scripts).some((x) => x))
      this.iconPath = checkmarkIconPath;
  }
}

class TreeItemScript extends vscode.TreeItem {
  label: string;
  parent: string;
  constructor(label: string, parent: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    this.parent = parent;
    if (onDisk) this.iconPath = checkmarkIconPath;
  }
}

class TreeItemWebtemp extends vscode.TreeItem {
  label: string;
  constructor(label: string, onDisk: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.label = label;
    if (onDisk) this.iconPath = checkmarkIconPath;
  }
}
