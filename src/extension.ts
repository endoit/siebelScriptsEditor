import * as vscode from "vscode";
import { openSettings, setupWorkspaceFolder } from "./utils";
import {
  refreshState,
  createDataSource,
  createConfig,
  newWorkspace,
  refreshConfig,
} from "./state";
import {
  compare,
  pull,
  push,
  parseFilePath,
  reparseFilePath,
  search,
  pushAll,
  newScript,
  checkFileChange,
} from "./buttonAction";
import {
  newService,
  compareTree,
  newScriptTree,
  pullAllTree,
  refreshTree,
  selectTreeItem,
  showFilesOnDisk,
} from "./treeView";

export async function activate({
  extensionUri,
  subscriptions,
}: vscode.ExtensionContext) {
  try {
    await setupWorkspaceFolder(extensionUri);

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: createDataSource(extensionUri, subscriptions),
    });

    vscode.window.onDidChangeActiveTextEditor(parseFilePath);
    vscode.workspace.onDidRenameFiles(reparseFilePath);
    vscode.workspace.onDidChangeTextDocument(checkFileChange);
    vscode.workspace.onDidChangeConfiguration(refreshConfig);

    const commands = {
      pull,
      push,
      compare,
      search,
      pushAll,
      newScript,
      newWorkspace,
      refreshState,
      newConnection: createConfig(extensionUri, subscriptions, "new"),
      editConnection: createConfig(extensionUri, subscriptions, "edit"),
      openSettings,
      selectTreeItem,
      showFilesOnDisk,
      newService,
      pullAllTree,
      refreshTree,
      newScriptTree,
      compareTree,
    } as const;

    for (const [command, callback] of Object.entries(commands)) {
      subscriptions.push(
        vscode.commands.registerCommand(
          `siebelscriptandwebtempeditor.${command}`,
          callback
        )
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
}
