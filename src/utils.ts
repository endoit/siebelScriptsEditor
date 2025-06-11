import * as vscode from "vscode";
import {
  baseConfig,
  baseScripts,
  customScriptItem,
  dataSourceOptions,
  error,
  newScriptOptions,
  openFileOptions,
  query,
  workspaceDialogOptions,
} from "./constants";
import { create } from "axios";
import { settings } from "./settings";
import { treeView } from "./treeView";

export const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!;

const compareFileUris =
    workspaceUri &&
    ({
      js: vscode.Uri.joinPath(workspaceUri, "compare", "compare.js"),
      ts: vscode.Uri.joinPath(workspaceUri, "compare", "compare.ts"),
      html: vscode.Uri.joinPath(workspaceUri, "compare", "compare.html"),
    } as const),
  restApi = create(baseConfig);

export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

export const setButtonVisibility = (button: Button, isEnabled: boolean) =>
  vscode.commands.executeCommand(
    "setContext",
    `siebelscriptandwebtempeditor.${button}Enabled`,
    isEnabled
  );

export const joinPath = (...parts: string[]) => parts.join("/");

export const getObject = async (
  action: RestAction,
  { url: baseURL, username, password }: RestConfig,
  path: string
): Promise<RestResponse> => {
  try {
    const request = {
        baseURL,
        auth: { username, password },
        params: query[action],
      },
      response = await restApi.get(path, request),
      data = response?.data?.items ?? [];
    return data;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      err.response?.status === 404
        ? error[action]
        : `Error using the Siebel REST API: ${
            err.response?.data?.ERROR ?? err.message
          }`
    );
    return [];
  }
};

export const putObject = async (
  { url: baseURL, username, password }: Config,
  path: string,
  data: Payload
) => {
  try {
    const request = { baseURL, auth: { username, password } };
    await restApi.put(path, data, request);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Error using the Siebel REST API: ${
        err.response?.data?.ERROR ?? err.message
      }`
    );
    return false;
  }
};

export const exists = async (resourceUri: vscode.Uri) => {
  try {
    await vscode.workspace.fs.stat(resourceUri);
    return true;
  } catch (err: any) {
    return false;
  }
};

export const isFileScript = (ext: string): ext is "js" | "ts" =>
  ext === "js" || ext === "ts";

export const isFileWebTemp = (ext: string): ext is "html" => ext === "html";

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

export const getScriptsOnDisk = createGetFilesOnDisk(isFileScript);
export const getWebTempsOnDisk = createGetFilesOnDisk(isFileWebTemp);

export const getScriptParentsOnDisk = async (folderUri: vscode.Uri) => {
  const folders: RestResponse = [],
    isFolder = await exists(folderUri);
  if (!isFolder) return folders;
  const content = await vscode.workspace.fs.readDirectory(folderUri);
  for (const [Name, fileType] of content) {
    if (fileType !== 2) continue;
    folders.push({ Name });
  }
  return folders;
};

export const createFolder = async (...parts: string[]) => {
  const folderUri = vscode.Uri.joinPath(workspaceUri, ...parts),
    isFolder = await exists(folderUri);
  if (!isFolder) await vscode.workspace.fs.createDirectory(folderUri);
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

export const createValidateWorkspaceName =
  (workspaces: string[]) => async (value: string) => {
    const parts = value.split("_");
    if (
      !value ||
      !/^[A-Za-z0-9_-]+$/.test(value) ||
      parts.length === 1 ||
      (parts.length === 2 && parts[1] === "")
    )
      return "Invalid workspace name!";
    if (workspaces.includes(value)) return "Workspace already exists!";
    return "";
  };

const isFileNameValid = (name: string) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || name === "(declarations)";

export const createValidateScriptName = (files: OnDisk) => (value: string) =>
  isFileNameValid(value)
    ? files.has(value)
      ? "Script already exists!"
      : ""
    : "Invalid script name!";

export const isScriptNameValid = (name: string, text: string) =>
  new RegExp(`function\\s+${name}\\s*\\(`).test(text) ||
  name === "(declarations)";

export const getFileUri = (folderUri: vscode.Uri, name: string, ext: FileExt) =>
  vscode.Uri.joinPath(folderUri, `${name}.${ext}`);

export const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, openFileOptions);
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Unable to open ${fileUri.fsPath}, file does not exist!`
    );
  }
};

export const writeFile = async (fileUri: vscode.Uri, fileContent: string) => {
  try {
    const content = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(fileUri, content);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const readFile = async (fileUri: vscode.Uri) => {
  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(content).toString("utf8");
  } catch (err: any) {
    return undefined;
  }
};

export const createNewScript = async (
  folderUri: vscode.Uri,
  baseScriptItems: readonly vscode.QuickPickItem[]
) => {
  const files = await getScriptsOnDisk(folderUri),
    items: vscode.QuickPickItem[] = [
      customScriptItem,
      ...baseScriptItems.filter(({ label }) => !files.has(label)),
    ] as const,
    answer = await vscode.window.showQuickPick(items, newScriptOptions);
  if (!answer) return;
  const isCustom = answer.label === "Custom",
    label = isCustom
      ? await vscode.window.showInputBox({
          placeHolder: "Enter server script name",
          validateInput: createValidateScriptName(files),
        })
      : answer.label;
  if (!label) return;
  const content = isCustom
    ? `function ${label}(){\n\n}`
    : baseScripts[<keyof typeof baseScripts>label];
  const fileUri = getFileUri(folderUri, label, settings.fileExtension);
  await writeFile(fileUri, content);
  await openFile(fileUri);
};

export const compareObjects = async (
  response: RestResponse,
  field: Field,
  ext: FileExt,
  fileUri: vscode.Uri,
  compareMessage: string
) => {
  const content = response[0]?.[field];
  if (content === undefined) return;
  await writeFile(compareFileUris[ext], content);
  await vscode.commands.executeCommand(
    "vscode.diff",
    compareFileUris[ext],
    fileUri,
    compareMessage
  );
};

export const pullMissing = async (
  response: RestResponse,
  folderUri: vscode.Uri,
  type?: Type
) => {
  const onDisk = await getScriptsOnDisk(folderUri);
  for (const { Name: label, Script: text } of response) {
    if (onDisk.has(label) || !text) continue;
    const fileUri = getFileUri(folderUri, label, settings.fileExtension);
    await writeFile(fileUri, text);
    if (type) treeView.setTreeItemIconToSame(type, label, folderUri);
  }
};

export const getHTML = async (
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  fileName: "dataSource" | "config" | "openWorkspace"
) => {
  const fileUri = vscode.Uri.joinPath(
      extensionUri,
      "webview",
      `${fileName}.html`
    ),
    fileContent = await readFile(fileUri),
    styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "style.css")
    ),
    replacedHTML = fileContent!.replace("./style.css", styleUri.toString());
  return replacedHTML;
};

export const openWorkspace = async (
  extensionUri: vscode.Uri,
  subscriptions: Subscriptions,
  webview: vscode.Webview
) => {
  webview.options = dataSourceOptions;
  webview.onDidReceiveMessage(
    async () => {
      const folder = await vscode.window.showOpenDialog(workspaceDialogOptions);
      if (!folder || folder.length === 0) return;
      await vscode.commands.executeCommand("vscode.openFolder", folder[0]);
    },
    undefined,
    subscriptions
  );
  webview.html = await getHTML(extensionUri, webview, "openWorkspace");
  return;
};

export const setupWorkspaceFolder = async (extensionUri: vscode.Uri) => {
  try {
    if (!workspaceUri) return;
    const typeDefUri = vscode.Uri.joinPath(workspaceUri, "index.d.ts"),
      isTypeDef = await exists(typeDefUri),
      siebelTypesUri = vscode.Uri.joinPath(extensionUri, "siebelTypes.txt"),
      jsconfigUri = vscode.Uri.joinPath(workspaceUri, "jsconfig.json"),
      isJsconfig = await exists(jsconfigUri),
      jsConfig = `{\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true\n  }\n}`;
    if (!isTypeDef) {
      await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
      vscode.window.showInformationMessage(
        `File index.d.ts was created in the ${workspaceUri.fsPath} folder!`
      );
    }
    if (!isJsconfig) {
      await writeFile(jsconfigUri, jsConfig);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in the ${workspaceUri.fsPath} folder!`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
