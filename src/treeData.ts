import { join } from "path";
import * as vscode from "vscode";
import {
  IS_WEBTEMPLATE,
  ONLY_METHOD_NAMES,
  WEBTEMP,
  SIEBEL_OBJECTS,
} from "./constants";
import {
  getServerScriptMethod,
  getServerScripts,
  getWebTemplate,
} from "./dataService";
import { writeFile, writeInfo } from "./fileRW";

//handle selection in the tree views
export const selectionChange = async (
  e: vscode.TreeViewSelectionChangeEvent<TreeItem>,
  type: SiebelObject,
  selected: Selected,
  dataObj: ScriptObject | WebTempObject,
  treeObj: TreeDataProvider,
  { singleFileAutoDownload, localFileExtension, defaultScriptFetching }: ExtendedSettings
) => {
  const selItem = e.selection[0];
  const folderPath = `${selected.connection}/${selected.workspace}/${type}`;
  let answer: ExtendedSettings["defaultScriptFetching"];
  let scrName: string;
  let scrMethod: Script;
  let scrNames: string[] = [];

  if (type === WEBTEMP) {
    dataObj = dataObj as WebTempObject;
    selected[type].name = selItem.label;
    answer = singleFileAutoDownload
      ? "Yes"
      : await vscode.window.showInformationMessage(
          `Do you want to get the ${selItem.label} ${SIEBEL_OBJECTS[type]} definition from Siebel?`,
          "Yes",
          "No"
        );
    if (answer === "Yes") {
      dataObj[selItem.label].definition = await getWebTemplate(selected);
      dataObj[selItem.label].onDisk = true;
      await writeFile(
        dataObj[selItem.label].definition,
        folderPath,
        selItem.label
      );
      await writeInfo(selected, folderPath, type, [selItem.label]);
      treeObj.refresh(dataObj, IS_WEBTEMPLATE);
    }
    return;
  }

  if (!selItem.hasOwnProperty("scripts")) {
    selected[type].name = selItem.parent!;
    selected[type].childName = selItem.label;
    answer = singleFileAutoDownload
      ? "Yes"
      : await vscode.window.showInformationMessage(
          `Do you want to get the ${selItem.label} ${SIEBEL_OBJECTS[type]} method from Siebel?`,
          "Yes",
          "No"
        );
    if (answer === "Yes") {
      dataObj = dataObj as ScriptObject;
      dataObj[selItem.parent!].onDisk = true;
      dataObj[selItem.parent!].scripts[selItem.label].script =
        await getServerScriptMethod(selected, type);
      dataObj[selItem.parent!].scripts[selItem.label].onDisk = true;
      await writeFile(
        dataObj[selItem.parent!].scripts[selItem.label].script!,
        folderPath,
        selItem.parent!,
        localFileExtension,
        selItem.label
      );
      await writeInfo(selected, folderPath, type, [selItem.label]);
      treeObj.refresh(dataObj);
    }
    return;
  }
  selected[type].name = selItem.label;
  answer =
    defaultScriptFetching !== "None - always ask"
      ? defaultScriptFetching
      : await vscode.window.showInformationMessage(
          `Do you want to get the ${selItem.label} ${SIEBEL_OBJECTS[type]} from Siebel?`,
          "Yes",
          "Only method names",
          "No"
        );
  dataObj = dataObj as ScriptObject;
  if (answer === "Yes" || answer === "All scripts") {
    dataObj[selItem.label].onDisk = true;
    dataObj[selItem.label].scripts = await getServerScripts(selected, type);
    for ([scrName, scrMethod] of Object.entries(
      dataObj[selItem.label].scripts
    )) {
      await writeFile(
        scrMethod.script!,
        folderPath,
        selItem.label,
        localFileExtension,
        scrName
      );
      scrNames.push(scrName);
    }
    await writeInfo(selected, folderPath, type, scrNames);
    treeObj.refresh(dataObj);
    return;
  }
  if (answer === "Only method names") {
    dataObj[selItem.label].scripts = await getServerScripts(
      selected,
      type,
      ONLY_METHOD_NAMES
    );
    treeObj.refresh(dataObj);
    return;
  }
};

//creates tree data
export class TreeDataProvider {
  _onDidChangeTreeData = new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data: TreeItem[];

  constructor(dataObj: ScriptObject | WebTempObject, isWebTemplate = false) {
    if (isWebTemplate) {
      this.data = Object.keys(dataObj).map(
        (bs) =>
          new TreeItem(bs, vscode.TreeItemCollapsibleState.None, {
            onDisk: dataObj[bs].onDisk,
            definition: (dataObj as WebTempObject)[bs].definition,
          })
      );
    } else {
      this.data = Object.keys(dataObj).map(
        (bs) =>
          new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, {
            onDisk: dataObj[bs].onDisk,
            scripts: (dataObj as ScriptObject)[bs].scripts,
          })
      );
    }
  }
  getTreeItem(element: TreeItem) {
    return element;
  }
  getChildren(element: TreeItem) {
    if (element === undefined) {
      return this.data;
    }
    return Object.keys(element.scripts as Scripts).map(
      (bs) =>
        new TreeItem(bs, vscode.TreeItemCollapsibleState.None, {
          onDisk: element.scripts?.[bs].onDisk as boolean,
          scripts: undefined,
          parent: element.label,
        })
    );
  }
  refresh(dataObj: ScriptObject | WebTempObject, isWebTemplate?: boolean) {
    if (isWebTemplate) {
      this.data = Object.keys(dataObj).map(
        (bs) =>
          new TreeItem(bs, vscode.TreeItemCollapsibleState.None, {
            onDisk: (dataObj as WebTempObject)[bs].onDisk,
            definition: (dataObj as WebTempObject)[bs].definition,
          })
      );
    } else {
      this.data = Object.keys(dataObj).map(
        (bs) =>
          new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, {
            onDisk: (dataObj as ScriptObject)[bs].onDisk,
            scripts: (dataObj as ScriptObject)[bs].scripts,
          })
      );
    }
    this._onDidChangeTreeData.fire(null);
  }
}

//creates the tree items for tree data
export class TreeItem extends vscode.TreeItem {
  label: string;
  scripts?: Scripts;
  onDisk?: boolean;
  parent?: string;
  definition?: string;
  constructor(
    label: string,
    collabsibleState: vscode.TreeItemCollapsibleState,
    { onDisk, scripts, parent, definition }: TreeItemProps
  ) {
    super(label, collabsibleState);
    this.label = label;
    if (scripts !== undefined) {
      this.scripts = scripts;
    } else if (parent !== undefined) {
      this.parent = parent;
    } else if (definition !== undefined) {
      this.definition = definition;
    }
    if (onDisk) {
      this.iconPath = {
        light: join(__filename, "..", "..", "media", "checkmark.png"),
        dark: join(__filename, "..", "..", "media", "checkmark.png"),
      };
    }
  }
}
