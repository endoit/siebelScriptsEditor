import * as vscode from "vscode";
import { error } from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import { ExtensionStateManager } from "./ExtensionStateManager";

export async function activate(context: vscode.ExtensionContext) {
  try {
    if (!vscode.workspace.workspaceFolders) throw error.noWorkspaceFolder;
    await Settings.moveDeprecated();
    await Utils.setupWorkspaceFolder(context);
    new ExtensionStateManager(context);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.toString());
  }
}

export function deactivate() {}
