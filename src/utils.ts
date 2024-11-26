import * as vscode from "vscode";
import {
  siebelObjectUrls,
  query,
  error,
  success,
  buttonOptions,
  paths,
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
        : `Error using the Siebel REST API: ${
            err.response?.data?.ERROR ?? err.message
          }`
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

export const getRestWorkspaces = async (
  url: string,
  username: string,
  password: string
) => {
  const workspaces = [],
    request: RequestConfig = {
      method: "get",
      url: [url, paths.restWorkspaces].join("/"),
      auth: { username, password },
      params: query.restWorkspaces,
    },
    data = await callRestApi("restWorkspaces", request);
  for (const { Name } of data) {
    workspaces.push(Name);
  }
  return workspaces;
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
      { url, username, password, workspaces, restWorkspaces } =
        getConfig(connection),
      urlParts = siebelObjectUrls[<Type>type];
    const options: vscode.QuickPickItem[] = [
        { label: workspace, description: "Compare in the same workspace" },
      ],
      workspaceList =
        isCompare && restWorkspaces
          ? await getRestWorkspaces(url, username, password)
          : workspaces;
    for (const workspaceItem of workspaceList) {
      if (workspaceItem === workspace) continue;
      options.push({ label: workspaceItem });
    }
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
      answer = isCompare
        ? await vscode.window.showQuickPick(options, {
            title: "Choose a workspace to compare against",
            placeHolder: "Workspace",
            canPickMany: false,
          })
        : await vscode.window.showInformationMessage(
            `Do you want to ${action} the ${name} ${message} ${fromTo} the ${workspace} workspace of the ${connection} connection?`,
            ...answerOptions
          );
    if (!answer || answer === "No") return;
    const otherWorkspace = (<vscode.QuickPickItem>answer).label ?? "",
      request: RequestConfig = {
        method,
        url: [
          url,
          "workspace",
          isCompare ? otherWorkspace : workspace,
          urlParts.parent,
          path,
        ].join("/"),
        auth: { username, password },
      };

    switch (action) {
      case "compare":
      case "pull":
        request.params = query.pull[field];
        const response = await callRestApi(action, request),
          content = response[0]?.[field];
        if (content === undefined) return;
        if (!isCompare) return await writeFile(document.uri, content);
        await writeFile(compareUri, content);
        return await vscode.commands.executeCommand(
          "vscode.diff",
          compareUri,
          document.uri,
          `Comparison of ${name} between ${otherWorkspace} and ${workspace} (downloaded)`
        );
      case "push":
        await document.save();
        const text = document.getText();
        request.data = { Name: name, [field]: text };
        if (!isScript) return await callRestApi("push", request);
        request.data["Program Language"] = "JS";
        const differs =
          !new RegExp(`function\\s+${name}\\s*\\(`).test(text) &&
          name !== "(declarations)";
        if (differs) return vscode.window.showErrorMessage(error.nameDifferent);
        return await callRestApi("push", request);
    }
  };
};

export const pull = buttonAction("pull");
export const push = buttonAction("push");
export const compare = buttonAction("compare");

export const setupWorkspaceFolder = async (extensionUri: vscode.Uri) => {
  try {
    if (!workspaceUri) return;
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
