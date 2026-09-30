import * as vscode from "vscode";
import { RestResponse } from "./rest";

export type FileExt = "js" | "ts" | "escript" | "html";

export type OnDisk = Map<string, FileExt>;

const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!,
  openFileOptions = { preview: false } as const,
  encoder = new TextEncoder(),
  decoder = new TextDecoder();

const createGetFilesOnDisk =
  (isFileValid: (ext: string) => ext is FileExt) =>
  async (folderUri: vscode.Uri) => {
    const files: OnDisk = new Map(),
      isFolder = await exists(folderUri);
    if (!isFolder) return files;
    const content = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [nameExt, fileType] of content) {
      const [name, ext] = nameExt.split(".");
      if (!name || fileType !== 1 || !isFileValid(ext)) continue;
      files.set(name, ext);
    }
    return files;
  };

export const compareFileUris =
    workspaceUri &&
    ({
      js: vscode.Uri.joinPath(workspaceUri, "compare", "compare.js"),
      ts: vscode.Uri.joinPath(workspaceUri, "compare", "compare.ts"),
      escript: vscode.Uri.joinPath(workspaceUri, "compare", "compare.escript"),
      html: vscode.Uri.joinPath(workspaceUri, "compare", "compare.html"),
    } as const),
  typesFolderUri = workspaceUri && vscode.Uri.joinPath(workspaceUri, "types"),
  connectionShimFileUri =
    workspaceUri && vscode.Uri.joinPath(workspaceUri, "connection-shim.ts");

export const getWorkspaceUri = (connection: string, workspace: string) =>
  vscode.Uri.joinPath(workspaceUri, connection, workspace);

export const exists = async (resourceUri: vscode.Uri) => {
  try {
    await vscode.workspace.fs.stat(resourceUri);
    return true;
  } catch (err: any) {
    return false;
  }
};

export const isFileScript = (ext: string): ext is "js" | "ts" | "escript" =>
  ext === "js" || ext === "ts" || ext === "escript";

export const isFileWebTemp = (ext: string): ext is "html" => ext === "html";

export const getScriptsOnDisk = createGetFilesOnDisk(isFileScript);

export const getWebTempsOnDisk = createGetFilesOnDisk(isFileWebTemp);

export const getScriptParentsOnDisk = async (folderUri: vscode.Uri) => {
  const folders: RestResponse[] = [],
    isFolder = await exists(folderUri);
  if (!isFolder) return folders;
  const content = await vscode.workspace.fs.readDirectory(folderUri);
  for (const [Name, fileType] of content) {
    if (fileType !== 2) continue;
    folders.push({ Name });
  }
  return folders;
};

export const createFolder = async (connection: string, workspace: string) => {
  const folderUri = vscode.Uri.joinPath(workspaceUri, connection, workspace),
    isFolder = await exists(folderUri);
  if (isFolder) return;
  await vscode.workspace.fs.createDirectory(folderUri);
};

export const getLocalWorkspaces = async (connection: string) => {
  const workspaces: string[] = [],
    folderUri = vscode.Uri.joinPath(workspaceUri, connection);
  await createFolder(connection, "MAIN");
  const content = await vscode.workspace.fs.readDirectory(folderUri);
  for (const [workspace, fileType] of content) {
    if (fileType !== 2) continue;
    workspaces.push(workspace);
  }
  return workspaces;
};

export const getFileUri = (folderUri: vscode.Uri, name: string, ext: FileExt) =>
  vscode.Uri.joinPath(folderUri, `${name}.${ext}`);

export const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, openFileOptions);
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Unable to open ${fileUri.fsPath}, file does not exist!`,
    );
  }
};

export const writeFile = async (fileUri: vscode.Uri, fileContent: string) => {
  try {
    const content = encoder.encode(fileContent);
    await vscode.workspace.fs.writeFile(fileUri, content);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const readFile = async (fileUri: vscode.Uri) => {
  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    return decoder.decode(content);
  } catch (err: any) {
    return "";
  }
};

export const getHTML = async (
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  fileName: "dataSource" | "config" | "openWorkspace",
) => {
  const fileUri = vscode.Uri.joinPath(
      extensionUri,
      "webview",
      `${fileName}.html`,
    ),
    fileContent = await readFile(fileUri),
    styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "style.css"),
    );
  return fileContent.replace("./style.css", styleUri.toString());
};

export const setupWorkspaceFolder = async (extensionUri: vscode.Uri) => {
  try {
    if (!workspaceUri) return;
    const copyFolderUri = vscode.Uri.joinPath(extensionUri, "copy"),
      filesToCopy = await vscode.workspace.fs.readDirectory(copyFolderUri);
    for (const [srcFileName] of filesToCopy) {
      const targetFileName = srcFileName.split(".txt")[0],
        targetUri = vscode.Uri.joinPath(workspaceUri, targetFileName),
        isTarget = await exists(targetUri);
      if (isTarget) continue;
      const srcUri = vscode.Uri.joinPath(copyFolderUri, srcFileName);
      await vscode.workspace.fs.copy(srcUri, targetUri);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
