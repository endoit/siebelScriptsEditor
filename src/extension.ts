import * as vscode from "vscode";
import { moveDeprecatedSettings } from "./settings";
import { openSettings, setupWorkspaceFolder } from "./utils";
import { refreshConnections, dataSourceWebview, configWebview } from "./state";
import {
  compare,
  pull,
  push,
  parseFilePath,
  reparseFilePath,
} from "./buttonAction";

export async function activate({
  extensionUri,
  subscriptions,
}: vscode.ExtensionContext) {
  try {
    await moveDeprecatedSettings();
    await setupWorkspaceFolder(extensionUri);

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: dataSourceWebview(subscriptions),
    });

    vscode.window.onDidChangeActiveTextEditor(parseFilePath);
    vscode.workspace.onDidRenameFiles(reparseFilePath);

    const commands = {
      pull,
      push,
      compare,
      refreshConnections,
      newConnection: configWebview(subscriptions, "new"),
      editConnection: configWebview(subscriptions, "edit"),
      openSettings,
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
