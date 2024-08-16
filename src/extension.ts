import * as vscode from "vscode";
import { error } from "./constants";
import { initialize } from "./extensionState";

export async function activate(context: vscode.ExtensionContext) {
  try {
    if (!vscode.workspace.workspaceFolders) throw error.noWorkspaceFolder;
    await initialize(context);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.toString());
  }
}

export function deactivate() {}
