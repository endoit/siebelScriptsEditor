import * as vscode from "vscode";
import {
  buttonError,
  compareOptions,
  error,
  paths,
  pullNo,
  pushNo,
  siebelObjectUrls,
} from "./constants";
import { getConfig } from "./settings";
import {
  compareFileUris,
  getObject,
  isFileScript,
  isFileWebTemp,
  putObject,
  writeFile,
  enableButtons,
} from "./utils";

let document: vscode.TextDocument,
  name: string,
  ext: FileExtNoDot,
  field: Field,
  resourceUrl: string,
  message: string,
  workspace: string,
  config: Config,
  workspaceUrl: string;

export const parseFilePath = (textEditor: vscode.TextEditor | undefined) => {
  try {
    if (!textEditor) throw buttonError;
    document = textEditor.document;
    const parts = document.uri.path.split("/");
    [name, ext] = <[string, FileExtNoDot]>parts.pop()!.split(".");
    switch (true) {
      case isFileScript(ext) && parts.length > 4:
        const parentObject = parts.pop()!,
          { parent, child } = siebelObjectUrls[<Type>parts.pop()] ?? {};
        if (!parent) throw buttonError;
        field = "Script";
        resourceUrl = [parent, parentObject, child, name].join("/");
        message = `script of the ${parent} ${parentObject}`;
        break;
      case isFileWebTemp(ext) && parts.pop() === "webtemp" && parts.length > 3:
        field = "Definition";
        resourceUrl = ["Web Template", name].join("/");
        message = "web template definition";
        break;
      default:
        throw buttonError;
    }
    workspace = parts.pop()!;
    config = getConfig(parts.pop()!);
    if (Object.keys(config).length === 0) throw buttonError;
    workspaceUrl = ["workspace", workspace, resourceUrl].join("/");
    enableButtons(true, workspace, config.username);
  } catch (err: any) {
    enableButtons(false);
  }
};

export const reparseFilePath = (event: vscode.FileRenameEvent) => {
  const textEditor = vscode.window?.activeTextEditor;
  if (!textEditor) return;
  for (const { newUri } of event.files) {
    if (textEditor.document?.uri.path !== newUri.path) continue;
    return parseFilePath(textEditor);
  }
};

export const pull = async () => {
  const answer = await vscode.window.showInformationMessage(
    `Do you want to pull the ${name} ${message} from the ${workspace} workspace of the ${config.name} connection?`,
    ...pullNo
  );
  if (answer !== "Pull") return;
  const response = await getObject(`pull${field}`, config, workspaceUrl),
    content = response[0]?.[field];
  if (content === undefined) return;
  await writeFile(document.uri, content);
};

export const push = async () => {
  await document.save();
  const text = document.getText(),
    payload = { Name: name, [field]: text };
  if (isFileScript(ext)) {
    if (
      !new RegExp(`function\\s+${name}\\s*\\(`).test(text) &&
      name !== "(declarations)"
    )
      return vscode.window.showErrorMessage(error.nameDifferent);
    payload["Program Language"] = "JS";
  }
  const answer = await vscode.window.showInformationMessage(
    `Do you want to push the ${name} ${message} to the ${workspace} workspace of the ${config.name} connection?`,
    ...pushNo
  );
  if (answer !== "Push") return;
  await putObject(config, workspaceUrl, payload);
};

export const compare = async () => {
  const { workspaces, restWorkspaces } = config,
    options: vscode.QuickPickItem[] = [
      {
        label: workspace,
        description: "Compare in the same workspace",
      },
    ];
  if (restWorkspaces) {
    const data = await getObject("allWorkspaces", config, paths.restWorkspaces);
    while (data.length > 0) {
      const {
        Name: label,
        Status: description,
        RepositoryWorkspace,
      } = data.pop()!;
      if (RepositoryWorkspace) data.push(...RepositoryWorkspace);
      if (label === workspace) continue;
      options.push({ label, description });
    }
  } else {
    for (const label of workspaces) {
      if (label === workspace) continue;
      options.push({ label });
    }
  }
  const answer = await vscode.window.showQuickPick(options, compareOptions);
  if (!answer) return;
  const { label } = answer,
    relativeUrl = ["workspace", label, resourceUrl].join("/"),
    response = await getObject(`compare${field}`, config, relativeUrl),
    content = response[0]?.[field];
  if (content === undefined) return;
  await writeFile(compareFileUris[ext], content);
  await vscode.commands.executeCommand(
    "vscode.diff",
    compareFileUris[ext],
    document.uri,
    `Comparison of ${name} between ${label} and ${workspace} (downloaded)`
  );
};
