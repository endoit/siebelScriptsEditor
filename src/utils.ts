import * as vscode from "vscode";
import {
  baseConfig,
  error,
  openFileOptions,
  query,
  success,
} from "./constants";
import { create } from "axios";

export const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!;

const restApi = create(baseConfig);

export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

export const setButtonVisiblity = (
  button: "pull" | "push" | "refresh" | "search",
  isEnabled: boolean
) =>
  vscode.commands.executeCommand(
    "setContext",
    `siebelscriptandwebtempeditor.${button}Enabled`,
    isEnabled
  );

export const joinWorkspace = (workspace: string, target: string) =>
  ["workspace", workspace, target].join("/");

export const handleRestError = (err: any, action: RestAction) => {
  vscode.window.showErrorMessage(
    err.response?.status === 404
      ? error[action]
      : `Error using the Siebel REST API: ${
          err.response?.data?.ERROR ?? err.message
        }`
  );
  return [];
};

export const getObject = async (
  action: RestAction,
  { url: baseURL, username, password }: RestRequest,
  relativeUrl: string
): Promise<RestResponse> => {
  try {
    const request = {
        baseURL,
        auth: { username, password },
        params: query[action],
      },
      response = await restApi.get(relativeUrl, request),
      data = response?.data?.items ?? [];
    vscode.window.showInformationMessage(success[action]);
    return data;
  } catch (err: any) {
    return handleRestError(err, action);
  }
};

export const putObject = async (
  { url: baseURL, username, password }: Config,
  relativeUrl: string,
  data: Payload
) => {
  try {
    const request = { baseURL, auth: { username, password } };
    await restApi.put(relativeUrl, data, request);
    vscode.window.showInformationMessage(success.push);
  } catch (err: any) {
    handleRestError(err, "push");
  }
};

const exists = async (resourceUri: vscode.Uri) => {
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
  (isFileValid: (ext: string) => ext is FileExtNoDot) =>
  async (folderUri: vscode.Uri) => {
    const files: OnDisk = new Map(),
      isFolder = await exists(folderUri);
    if (!isFolder) return files;
    const content = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [nameExt, fileType] of content) {
      if (fileType !== 1) continue;
      const [name, ext] = nameExt.split(".");
      if (!isFileValid(ext)) continue;
      files.set(name, `.${ext}`);
    }
    return files;
  };

export const getScriptsOnDisk = createGetFilesOnDisk(isFileScript);
export const getWebTempsOnDisk = createGetFilesOnDisk(isFileWebTemp);

export const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, openFileOptions);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const writeFile = async (fileUri: vscode.Uri, fileContent: string) => {
  try {
    const contents = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(fileUri, contents);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
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
