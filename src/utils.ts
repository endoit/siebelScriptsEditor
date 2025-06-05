import * as vscode from "vscode";
import {
  baseConfig,
  error,
  extNoDot,
  metadata,
  openFileOptions,
  query,
} from "./constants";
import { create } from "axios";

export const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!;

const restApi = create(baseConfig);

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
  ext === extNoDot.js || ext === extNoDot.ts;

export const isFileWebTemp = (ext: string): ext is "html" =>
  ext === extNoDot.html;
//áttérni . nélküli kiterjesztésre
const createGetFilesOnDisk =
  (isFileValid: (ext: string) => ext is FileExtNoDot) =>
  async (folderUri: vscode.Uri) => {
    const files: OnDisk = new Map(),
      isFolder = await exists(folderUri);
    if (!isFolder) return files;
    const content = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [nameExt, fileType] of content) {
      const [name, ext] = nameExt.split(".");
      if (fileType !== 1 || !isFileValid(ext)) continue;
      files.set(name, `.${ext}`);
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

const isFileNameValid = (name: string) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || name === "(declarations)";

export const createValidateInput = (files: OnDisk) => (value: string) =>
  isFileNameValid(value)
    ? files.has(value)
      ? "Script already exists!"
      : ""
    : "Invalid script name!";

export const isScriptNameValid = (name: string, text: string) =>
  new RegExp(`function\\s+${name}\\s*\\(`).test(text) ||
  name === "(declarations)";

export const getFileUri = (
  folderUri: vscode.Uri,
  fileName: string,
  fileExt: FileExt
) => vscode.Uri.joinPath(folderUri, `${fileName}${fileExt}`);

export const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, openFileOptions);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
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
