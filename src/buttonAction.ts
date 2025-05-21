import * as vscode from "vscode";
import {
  buttonError,
  compareOptions,
  error,
  paths,
  pullNo,
  pushNo,
  objectUrlParts,
  findInFilesOptions,
  pushAllNo,
} from "./constants";
import { getConfig, settings } from "./settings";
import {
  getObject,
  isFileScript,
  isFileWebTemp,
  putObject,
  readFile,
  writeFile,
  workspaceUri,
  setButtonVisiblity,
  getScriptsOnDisk,
  joinUrl,
  isNameValid,
} from "./utils";

const compareFileUris =
  workspaceUri &&
  ({
    js: vscode.Uri.joinPath(workspaceUri, "compare", "compare.js"),
    ts: vscode.Uri.joinPath(workspaceUri, "compare", "compare.ts"),
    html: vscode.Uri.joinPath(workspaceUri, "compare", "compare.html"),
  } as const);

let editor: vscode.TextEditor | undefined,
  document: vscode.TextDocument,
  name: string,
  ext: FileExtNoDot,
  field: Field,
  parentUrl: string,
  resourceUrl: string,
  searchUrl: string,
  message: string,
  workspace: string,
  config: Config,
  objectUrl: string,
  folderUri: vscode.Uri;

export const parseFilePath = (textEditor: vscode.TextEditor | undefined) => {
  let pullEnabled = true,
    pushEnabled = true,
    searchEnabled = true,
    pushAllEnabled = true;

  try {
    editor = textEditor;
    if (!editor) throw buttonError;
    document = editor.document;
    folderUri = vscode.Uri.joinPath(document.uri, "..");
    const parts = document.uri.path.split("/");
    [name, ext] = <[string, FileExtNoDot]>parts.pop()!.split(".");
    switch (true) {
      case isFileScript(ext) && parts.length > 4:
        const parent = parts.pop()!,
          urlParts = objectUrlParts[<Type>parts.pop()];
        if (!urlParts) throw buttonError;
        field = "Script";
        parentUrl = joinUrl(urlParts.parent, parent, urlParts.child);
        message = `script of the ${parent} ${urlParts.parent}`;
        break;
      case isFileWebTemp(ext) && parts.length > 3 && parts.pop() === "webtemp":
        searchEnabled = false;
        field = "Definition";
        parentUrl = "Web Template";
        message = "web template definition";
        break;
      default:
        throw buttonError;
    }
    workspace = parts.pop()!;
    config = getConfig(parts.pop()!);
    if (Object.keys(config).length === 0) throw buttonError;
    resourceUrl = joinUrl(parentUrl, name);
    objectUrl = joinUrl("workspace", workspace, resourceUrl);
    searchUrl = joinUrl("workspace", workspace, parentUrl);
    pushEnabled = workspace.includes(`_${config.username.toLowerCase()}_`);
    pushAllEnabled = searchEnabled && pushAllEnabled;
  } catch (err: any) {
    pullEnabled = false;
    pushEnabled = false;
    searchEnabled = false;
  }
  setButtonVisiblity("pull", pullEnabled);
  setButtonVisiblity("push", pushEnabled);
  setButtonVisiblity("search", searchEnabled);
  setButtonVisiblity("pushAll", pushAllEnabled);
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
  const response = await getObject(`pull${field}`, config, objectUrl),
    content = response[0]?.[field];
  if (content === undefined) return;
  await writeFile(document.uri, content);
};

export const push = async () => {
  await document.save();
  const text = document.getText(),
    payload = { Name: name, [field]: text };
  if (isFileScript(ext)) {
    if (!isNameValid(name, text))
      return vscode.window.showErrorMessage(error.nameDifferent);
    payload["Program Language"] = "JS";
  }
  const answer = await vscode.window.showInformationMessage(
    `Do you want to push the ${name} ${message} to the ${workspace} workspace of the ${config.name} connection?`,
    ...pushNo
  );
  if (answer !== "Push") return;
  const result = await putObject(config, objectUrl, payload);
  if (!result) return;
  vscode.window.showInformationMessage(
    `Successfully pushed ${name} to Siebel!`
  );
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
    const data = await getObject("allWorkspaces", config, paths.workspaces);
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
    relativeUrl = joinUrl("workspace", label, resourceUrl),
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

export const search = async () => {
  const selection = editor!.selection,
    selected = selection.isEmpty
      ? document.getWordRangeAtPosition(selection.active)
      : selection,
    query = selected ? document.getText(selected) : "",
    response = await getObject(`pullScript`, config, searchUrl),
    files = await getScriptsOnDisk(folderUri);
  for (const { Name, Script } of response) {
    if (files.has(Name) || !Script) continue;
    const fileUri = vscode.Uri.joinPath(
      folderUri,
      `${Name}${settings.localFileExtension}`
    );
    await writeFile(fileUri, Script);
  }
  await vscode.commands.executeCommand("workbench.action.findInFiles", {
    query,
    filesToInclude: folderUri.fsPath,
    ...findInFilesOptions,
  });
};

export const pushAll = async () => {
  const files = await getScriptsOnDisk(folderUri),
    answer = await vscode.window.showInformationMessage(
      `Do you want to push all scripts of the current parent object?`,
      ...pushAllNo
    ),
    error = [];
  if (answer !== "Push all") return;
  for (const [fileName, fileExt] of files) {
    const fileNameExt = `${fileName}${fileExt}`,
      fileUri = vscode.Uri.joinPath(folderUri, fileNameExt),
      text = await readFile(fileUri);
    if (!isNameValid(fileName, text)) {
      error.push(fileNameExt);
      continue;
    }
    const payload: Payload = {
        Name: fileName,
        Script: text,
        "Program Language": "JS",
      },
      relativeUrl = joinUrl(searchUrl, fileName),
      result = await putObject(config, relativeUrl, payload);
    if (!result) error.push(fileName);
  }
  if (error.length > 0)
    return vscode.window.showErrorMessage(
      `Unsuccesful push for the following script(s): ${error.join(", ")}`
    );
  vscode.window.showInformationMessage(
    "Successfully pushed all scripts to Siebel!"
  );
};
