import * as vscode from "vscode";
import { openSettings, setupWorkspaceFolder } from "./utils";
import {
  refreshConnections,
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
} from "./buttonAction";
import {
  newService,
  compareTree,
  newScriptTree,
  pullAllTree,
  refreshTree,
} from "./treeView";

export async function activate({
  extensionUri,
  subscriptions,
}: vscode.ExtensionContext) {
  try {
    await setupWorkspaceFolder(extensionUri);

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: createDataSource(subscriptions),
    });

    vscode.window.onDidChangeActiveTextEditor(parseFilePath);
    vscode.workspace.onDidRenameFiles(reparseFilePath);
    vscode.workspace.onDidChangeConfiguration(refreshConfig);

    const commands = {
      pull,
      push,
      compare,
      search,
      pushAll,
      newScript,
      newWorkspace,
      refreshConnections,
      newConnection: createConfig(subscriptions, "new"),
      editConnection: createConfig(subscriptions, "edit"),
      openSettings,
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
