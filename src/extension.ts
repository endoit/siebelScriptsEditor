import * as vscode from "vscode";
import { error } from "./constants";
import { moveDeprecatedSettings } from "./settings";
import {
  setupWorkspaceFolder,
  workspaceUri,
  push,
  pull,
  compare,
} from "./utils";
import { dataSourceWebview, configWebview } from "./state";

export async function activate({
  extensionUri,
  subscriptions,
}: vscode.ExtensionContext) {
  try {
    if (!workspaceUri)
      return vscode.window.showErrorMessage(error.noWorkspaceFolder);

    await moveDeprecatedSettings();
    await setupWorkspaceFolder(extensionUri);

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: dataSourceWebview(subscriptions),
    });

    const commands = {
      pull,
      push,
      compare,
      newConnection: configWebview(subscriptions, "new"),
      editConnection: configWebview(subscriptions, "edit"),
      openSettings: () =>
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "siebelScriptAndWebTempEditor"
        ),
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
    vscode.window.showErrorMessage(err?.message);
  }
}
