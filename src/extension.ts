import * as vscode from "vscode";
import { error } from "./constants";
import { moveDeprecatedSettings } from "./settings";
import { setupWorkspaceFolder, pushOrPull } from "./utils";
import { dataSourceWebview, configWebview } from "./extensionState";

export async function activate(context: vscode.ExtensionContext) {
  try {
    if (!vscode.workspace.workspaceFolders) throw error.noWorkspaceFolder;
    
    await moveDeprecatedSettings();
    await setupWorkspaceFolder(context);
  
    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: dataSourceWebview(context),
    });
  
    const commands = {
      pull: pushOrPull("pull"),
      push: pushOrPull("push"),
      newConnection: configWebview(context, true),
      editConnection: configWebview(context),
      openSettings: () =>
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "siebelScriptAndWebTempEditor"
        ),
    } as const;
  
    for (const [command, callback] of Object.entries(commands)) {
      vscode.commands.registerCommand(
        `siebelscriptandwebtempeditor.${command}`,
        callback
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.toString());
  }
}

export function deactivate() {}
