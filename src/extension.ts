import * as vscode from "vscode";
import { error } from "./constants";
import { moveDeprecatedSettings } from "./settings";
import { setupWorkspaceFolder, pushOrPull } from "./utils";
import { dataSourceWebview, configWebview } from "./state";

export async function activate({
  extensionUri,
  subscriptions,
}: vscode.ExtensionContext) {
  try {
    if (!vscode.workspace.workspaceFolders) throw error.noWorkspaceFolder;

    await moveDeprecatedSettings();
    await setupWorkspaceFolder(extensionUri);

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: dataSourceWebview(subscriptions),
    });

    const commands = {
      pull: pushOrPull("pull"),
      push: pushOrPull("push"),
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
    vscode.window.showErrorMessage(err?.message ?? err.toString());
  }
}
