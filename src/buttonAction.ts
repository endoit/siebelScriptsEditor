import * as vscode from "vscode";
import {
  buttonError,
  compareOptions,
  error,
  paths,
  pullNo,
  pushNo,
  metadata,
  findInFilesOptions,
  pushAllNo,
  fields,
} from "./constants";
import { getConfig, settings } from "./settings";
import {
  getObject,
  isFileScript,
  isFileWebTemp,
  putObject,
  readFile,
  writeFile,
  setButtonVisibility,
  getScriptsOnDisk,
  joinPath,
  isScriptNameValid,
  getFileUri,
  createNewScript,
  compareObjects,
  pullMissing,
  getLocalWorkspaces,
} from "./utils";

let editor: vscode.TextEditor | undefined,
  document: vscode.TextDocument,
  name: string,
  ext: FileExt,
  field: Field,
  baseScriptItems: readonly vscode.QuickPickItem[],
  parentPath: string,
  objectPath: string,
  parentFullPath: string,
  objectFullPath: string,
  message: string,
  messageAll: string,
  workspace: string,
  connection: string,
  config: Config,
  folderUri: vscode.Uri;

export const parseFilePath = async (
  textEditor: vscode.TextEditor | undefined
) => {
  const visibility = {
    pull: false,
    push: false,
    search: false,
    pushAll: false,
  };

  try {
    editor = textEditor;
    if (!editor) throw buttonError;
    document = editor.document;
    folderUri = vscode.Uri.joinPath(document.uri, "..");
    const parts = document.uri.path.split("/");
    [name, ext] = <[string, FileExt]>parts.pop()!.split(".");
    if (!name) throw buttonError;
    switch (true) {
      case isFileScript(ext) && parts.length > 4:
        const parent = parts.pop()!,
          type = <Type>parts.pop(),
          meta = metadata[type];
        if (!meta) throw buttonError;
        baseScriptItems = meta.baseScriptItems;
        field = fields.script;
        parentPath = joinPath(meta.parent, parent, meta.child);
        message = `script of the ${parent} ${meta.parent}`;
        messageAll = `all scripts of the ${parent} ${meta.parent}`;
        visibility.search = true;
        break;
      case isFileWebTemp(ext) && parts.length > 3 && parts.pop() === "webtemp":
        field = fields.definition;
        parentPath = "Web Template";
        message = "Web Template definition";
        break;
      default:
        throw buttonError;
    }
    workspace = parts.pop()!;
    connection = parts.pop()!;
    config = getConfig(connection);
    if (Object.keys(config).length === 0) throw buttonError;
    objectPath = joinPath(parentPath, name);
    parentFullPath = joinPath("workspace", workspace, parentPath);
    objectFullPath = joinPath(parentFullPath, name);
    visibility.pull = true;
    visibility.push = workspace.includes(`_${config.username.toLowerCase()}_`);
    visibility.pushAll = visibility.push && visibility.search;
    for (const [button, visible] of Object.entries(visibility)) {
      setButtonVisibility(<Button>button, visible);
    }
  } catch (err: any) {
    for (const button of Object.keys(visibility)) {
      setButtonVisibility(<Button>button, false);
    }
  }
};

export const reparseFilePath = ({ files }: vscode.FileRenameEvent) => {
  const textEditor = vscode.window?.activeTextEditor;
  if (!textEditor) return;
  for (const { newUri } of files) {
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
  const response = await getObject(`pull${field}`, config, objectFullPath),
    content = response[0]?.[field];
  if (content === undefined) return;
  await writeFile(document.uri, content);
};

export const push = async () => {
  await document.save();
  const text = document.getText(),
    payload = { Name: name, [field]: text };
  if (isFileScript(ext)) {
    if (!isScriptNameValid(name, text))
      return vscode.window.showErrorMessage(error.nameDifferent);
    payload["Program Language"] = "JS";
  }
  const answer = await vscode.window.showInformationMessage(
    `Do you want to push the ${name} ${message} to the ${workspace} workspace of the ${config.name} connection?`,
    ...pushNo
  );
  if (answer !== "Push") return;
  const result = await putObject(config, objectFullPath, payload);
  if (!result) return;
  vscode.window.showInformationMessage(
    `Successfully pushed ${name} to Siebel!`
  );
};

export const compare = async () => {
  const { restWorkspaces } = config,
    workspaces = await getLocalWorkspaces(connection),
    items: vscode.QuickPickItem[] = [
      {
        label: workspace,
        description: "Compare in the same workspace",
      },
    ];
  if (restWorkspaces) {
    const data = await getObject("allWorkspaces", config, paths.workspaces);
    while (data.length > 0) {
      const {
        Name: label,
        Status: description,
        RepositoryWorkspace,
      } = data.pop()!;
      if (RepositoryWorkspace) data.push(...RepositoryWorkspace);
      if (label === workspace) continue;
      items.push({ label, description });
    }
  } else {
    for (const label of workspaces) {
      if (label === workspace) continue;
      items.push({ label });
    }
  }
  const answer = await vscode.window.showQuickPick(items, compareOptions);
  if (!answer) return;
  const { label } = answer,
    compareFullPath = joinPath("workspace", label, objectPath),
    response = await getObject(`compare${field}`, config, compareFullPath),
    compareMessage = `Comparison of ${name} between ${label} and ${workspace} (on disk)`;
  await compareObjects(response, field, ext, document.uri, compareMessage);
};

export const search = async () => {
  const selection = editor!.selection,
    selected = selection.isEmpty
      ? document.getWordRangeAtPosition(selection.active)
      : selection,
    query = selected ? document.getText(selected) : "",
    response = await getObject("pullScript", config, parentFullPath);
  await pullMissing(response, folderUri);
  await vscode.commands.executeCommand("workbench.action.findInFiles", {
    query,
    filesToInclude: folderUri.fsPath,
    ...findInFilesOptions,
  });
};

export const pushAll = async () => {
  const files = await getScriptsOnDisk(folderUri),
    payloads = [],
    invalid = [];
  for (const [fileName, fileExt] of files) {
    const fileUri = getFileUri(folderUri, fileName, fileExt),
      text = await readFile(fileUri),
      payload: Payload = {
        Name: fileName,
        Script: text,
        "Program Language": "JS",
      };
    payloads.push(payload);
    if (text && isScriptNameValid(fileName, text)) continue;
    invalid.push(fileName);
  }
  if (invalid.length > 0)
    return vscode.window.showErrorMessage(
      `Unable to push all, file and function names differ for the following script(s): ${invalid.join(
        ", "
      )}`
    );
  const answer = await vscode.window.showInformationMessage(
    `Do you want to push ${messageAll} to the ${workspace} workspace of the ${config.name} connection?`,
    ...pushAllNo
  );
  if (answer !== "Push all") return;
  for (const payload of payloads) {
    const pushFullPath = joinPath(parentFullPath, payload.Name),
      result = await putObject(config, pushFullPath, payload);
    if (!result) return;
  }
  vscode.window.showInformationMessage(
    `Successfully pushed ${messageAll} to Siebel!`
  );
};

export const newScript = async () =>
  await createNewScript(folderUri, baseScriptItems);
