import * as vscode from "vscode";
import { ERR_NO_WS_OPEN, PULL, PUSH, IS_NEW_CONNECTION } from "./constants";
import {
  pushOrPullAction,
  moveDeprecatedSettings,
  createIndexdtsAndJSConfigjson,
} from "./utility";
import { TreeViews } from "./treeView";

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders?.[0].uri.fsPath)
    return vscode.window.showErrorMessage(ERR_NO_WS_OPEN);
  const treeViews = new TreeViews();

  await createIndexdtsAndJSConfigjson(context);
  await moveDeprecatedSettings();

  vscode.window.registerWebviewViewProvider("extensionView", {
    resolveWebviewView: treeViews.dataSourceWebview(context),
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pullScript",
      pushOrPullAction(PULL)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.pushScript",
      pushOrPullAction(PUSH)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.newConnection",
      treeViews.configWebview(context, IS_NEW_CONNECTION)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.editConnection",
      treeViews.configWebview(context)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "siebelscriptandwebtempeditor.openSettings",
      () =>
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "siebelScriptAndWebTempEditor"
        )
    )
  );
}

export function deactivate() {}
