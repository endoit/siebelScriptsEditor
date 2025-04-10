import * as vscode from "vscode";
import {
  baseConfig,
  error,
  openFileOptions,
  query,
  success,
} from "./constants";
import { create } from "axios";

export const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!,
  compareFileUris =
    workspaceUri &&
    ({
      js: vscode.Uri.joinPath(workspaceUri, "compare", "compare.js"),
      ts: vscode.Uri.joinPath(workspaceUri, "compare", "compare.ts"),
      html: vscode.Uri.joinPath(workspaceUri, "compare", "compare.html"),
    } as const),
  checkmarkIcon = new vscode.ThemeIcon("check"),
  searchInstance = create(baseConfig);

const restInstance = create(baseConfig);

export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

const setButtonContext = (button: "pull" | "push", isEnabled: boolean) =>
  vscode.commands.executeCommand(
    "setContext",
    `siebelscriptandwebtempeditor.${button}Enabled`,
    isEnabled
  );

export const enableButtons = (
  isEnabled: boolean,
  workspace = "",
  username = ""
) => {
  setButtonContext("pull", isEnabled);
  setButtonContext(
    "push",
    isEnabled && workspace.includes(`_${username.toLowerCase()}_`)
  );
};

const handleRestError = (err: any, action: RestAction) => {
  vscode.window.showErrorMessage(
    err.response?.status === 404
      ? error[action]
      : `Error using the Siebel REST API: ${
          err.response?.data?.ERROR ?? err.message
        }`
  );
  return [];
};

export const getTreeData = async (
  url: string,
  params: QueryParams
): Promise<RestResponse> => {
  try {
    const response = await searchInstance.get(url, { params });
    return response?.data?.items ?? [];
  } catch (err: any) {
    return handleRestError(err, "treeData");
  }
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
      response = await restInstance.get(relativeUrl, request),
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
    await restInstance.put(relativeUrl, data, request);
    vscode.window.showInformationMessage(success.push);
  } catch (err: any) {
    handleRestError(err, "push");
  }
};

export const isFileScript = (ext: string): ext is "js" | "ts" =>
  ext === "js" || ext === "ts";

export const isFileWebTemp = (ext: string): ext is "html" => ext === "html";

export const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, openFileOptions);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
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
