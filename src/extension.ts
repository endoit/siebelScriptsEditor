import * as vscode from "vscode";
import { error } from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import { ExtensionStateManager } from "./ExtensionStateManager";

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders)
    return vscode.window.showErrorMessage(error.noWorkspaceFolder);
  await Settings.moveDeprecatedSettings();
  await Utils.setupWorkspaceFolder(context.extensionUri);
  new ExtensionStateManager(context);
}

export function deactivate() {}
