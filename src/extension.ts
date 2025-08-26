import * as vscode from "vscode";
import { setupWorkspaceFolder } from "./utils";
import { webView } from "./webView";
import { activeEditor } from "./activeEditor";
import { treeView } from "./treeView";

export async function activate({
  extensionUri,
  subscriptions,
}: vscode.ExtensionContext) {
  try {
    await setupWorkspaceFolder(extensionUri);

    vscode.window.registerWebviewViewProvider("extensionView", {
      resolveWebviewView: webView.createDataSource(extensionUri, subscriptions),
    });

    vscode.window.onDidChangeActiveTextEditor(activeEditor.parseFilePath);
    vscode.workspace.onDidRenameFiles(activeEditor.reparseFilePath);
    vscode.workspace.onDidChangeConfiguration(webView.refreshConfig);

    const commands = {
      push: activeEditor.push,
      pushAll: activeEditor.pushAll,
      newScript: activeEditor.newScript,
      search: activeEditor.search,
      compare: activeEditor.compare,
      newWorkspace: webView.newWorkspace,
      refreshState: webView.refreshState,
      newConnection: webView.createConfig(extensionUri, subscriptions, "new"),
      editConnection: webView.createConfig(extensionUri, subscriptions, "edit"),
      selectTreeItem: treeView.select,
      searchDisk: treeView.searchDisk,
      showFilesOnDisk: treeView.showFilesOnDisk,
      newServiceTree: treeView.newService,
      pullAllTree: treeView.pullAll,
      newScriptTree: treeView.newScript,
      revertTree: treeView.revert,
      compareTree: treeView.compare,
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
