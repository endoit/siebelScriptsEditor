import * as vscode from "vscode";
import { ERR_NO_WS_OPEN } from "./constants";
import { Utils } from "./Utils";
import { Settings } from "./Settings";
import { ExtensionStateManager } from "./ExtensionStateManager";

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders)
    return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  await Settings.moveDeprecatedSettings();
  await Utils.createIndexdtsAndJSConfigjson(context.extensionUri);
  new ExtensionStateManager(context);
}

export function deactivate() {}
