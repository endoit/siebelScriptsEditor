import * as vscode from "vscode";
import {
  siebelObjectUrls,
  query,
  error,
  success,
  buttonOptions,
} from "./constants";
import { getConfig } from "./settings";
import axios from "axios";

export const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!;

const restApi = axios.create({
    withCredentials: true,
  }),
  compareUri = workspaceUri && vscode.Uri.joinPath(workspaceUri, ".compare");

export const callRestApi = async (
  action: RestAction,
  request: RequestConfig
): Promise<RestResponse> => {
  try {
    const response = await restApi(request),
      data = response?.data?.items ?? [];
    if (!success[action]) return data;
    vscode.window.showInformationMessage(success[action]);
    return data;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      err.response?.status === 404
        ? error[action]
        : `Error: ${err.response?.data?.ERROR ?? err.message}`
    );
    return [];
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

const buttonAction = (action: ButtonAction) => {
  const [fromTo, answerOptions, method, isCompare] = buttonOptions[action];
  return async () => {
    const document = vscode.window.activeTextEditor!.document,
      pathParts = document.uri.path.split("/"),
      [name, ext] = pathParts.at(-1)!.split("."),
      isScript = ext !== "html",
      [connection, workspace, type, parent] = pathParts.slice(
        isScript ? -5 : -4,
        -1
      ),
      { url, username, password } = getConfig(connection),
      urlParts = siebelObjectUrls[<Type>type];
    if (!url || !urlParts)
      return vscode.window.showErrorMessage(
        `Connection ${connection} was not found in the Connections setting or folder structure was changed manually and does not meet the expectations of the extension!`
      );
    const [field, path, message] = isScript
        ? [
            <Field>"Script",
            [parent, urlParts.child, name].join("/"),
            `script of the ${parent} ${urlParts.parent}`,
          ]
        : [<Field>"Definition", name, "web template definition"],
      request: RequestConfig = {
        method,
        url: [url, "workspace", workspace, urlParts.parent, path].join("/"),
        auth: { username, password },
      },
      answer = isCompare
        ? "Compare"
        : await vscode.window.showInformationMessage(
            `Do you want to ${action} the ${name} ${message} ${fromTo} the ${workspace} workspace of the ${connection} connection?`,
            ...answerOptions
          );
    switch (answer) {
      case "Pull":
      case "Compare":
        request.params = query.pull[field];
        const response = await callRestApi(action, request),
          content = response[0]?.[field];
        if (content === undefined) return;
        await writeFile(isCompare ? compareUri : document.uri, content);
        if (!isCompare) return;
        return await vscode.commands.executeCommand(
          "vscode.diff",
          compareUri,
          document.uri,
          `Comparison of ${name}`
        );
      case "Push":
        await document.save();
        const text = document.getText();
        request.data = { Name: name, [field]: text };
        if (!isScript) return await callRestApi("push", request);
        const sameName = new RegExp(`function\\s+${name}\\s*\\(`).test(text);
        if (!sameName && name !== "(declarations)")
          return vscode.window.showErrorMessage(error.nameDifferent);
        request.data["Program Language"] = "JS";
        return await callRestApi("push", request);
    }
  };
};

export const pull = buttonAction("pull");
export const push = buttonAction("push");
export const compare = buttonAction("compare");

export const setupWorkspaceFolder = async (extensionUri: vscode.Uri) => {
  try {
    const typeDefUri = vscode.Uri.joinPath(workspaceUri, "index.d.ts"),
      isTypeDef = await exists(typeDefUri),
      siebelTypesUri = vscode.Uri.joinPath(extensionUri, "siebelTypes.txt"),
      jsconfigUri = vscode.Uri.joinPath(workspaceUri, "jsconfig.json"),
      isJsconfig = await exists(jsconfigUri),
      jsConfig = `{\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true\n  }\n}`;
    switch (false) {
      case isTypeDef:
        await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
        vscode.window.showInformationMessage(
          `File index.d.ts was created in the ${workspaceUri.fsPath} folder!`
        );
        if (isJsconfig) return;
      case isJsconfig:
        await writeFile(jsconfigUri, jsConfig);
        return vscode.window.showInformationMessage(
          `File jsconfig.json was created in the ${workspaceUri.fsPath} folder!`
        );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
