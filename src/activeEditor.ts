import * as vscode from "vscode";
import {
  buttonError,
  compareOptions,
  error,
  paths,
  pushNo,
  metadata,
  pushAllNo,
  fields,
  itemStates,
  disableAllButtons,
} from "./constants";
import {
  getConfig,
  getObject,
  isFileScript,
  isFileWebTemp,
  putObject,
  readFile,
  setButtonVisibility,
  getScriptsOnDisk,
  joinPath,
  isScriptNameValid,
  getFileUri,
  compareObjects,
  getLocalWorkspaces,
  searchInFiles,
  createNewScript,
  openFile,
} from "./utils";
import { treeView } from "./treeView";

class ActiveEditor {
  private static instance: ActiveEditor;
  private editor: vscode.TextEditor | undefined;
  private declare document: vscode.TextDocument;
  private declare folderUri: vscode.Uri;
  private declare name: string;
  private declare ext: FileExt;
  private declare parent: string;
  private declare type: Type;
  private declare workspace: string;
  private declare connection: string;
  private declare config: Config;
  private declare field: Field;
  private declare defaultScripts: readonly vscode.QuickPickItem[];
  private declare parentPath: string;
  private declare objectPath: string;
  private declare parentFullPath: string;
  private declare objectFullPath: string;
  private declare objectFolderUri: vscode.Uri;

  static getInstance() {
    ActiveEditor.instance ??= new ActiveEditor();
    return ActiveEditor.instance;
  }

  parseFilePath = (textEditor: vscode.TextEditor | undefined) => {
    try {
      this.editor = textEditor;
      if (!this.editor) throw buttonError;
      this.document = this.editor.document;
      this.folderUri = vscode.Uri.joinPath(this.document.uri, "..");
      const parts = this.document.uri.path.split("/");
      [this.name, this.ext] = <[string, FileExt]>parts.pop()!.split(".");
      if (!this.name) throw buttonError;
      switch (true) {
        case isFileScript(this.ext) && parts.length > 4:
          this.parent = parts.pop()!;
          this.type = <Type>parts.pop();
          const meta = metadata[this.type];
          if (!meta) throw buttonError;
          this.objectFolderUri = vscode.Uri.joinPath(this.folderUri, "..");
          this.defaultScripts = meta.defaultScripts;
          this.field = fields.script;
          this.parentPath = joinPath(meta.parent, this.parent, meta.child);
          break;
        case isFileWebTemp(this.ext) &&
          parts.length > 3 &&
          parts.pop() === "webtemp":
          this.parent = "";
          this.type = "webtemp";
          this.objectFolderUri = this.folderUri;
          this.field = fields.definition;
          this.parentPath = metadata.webtemp.parent;
          break;
        default:
          throw buttonError;
      }
      this.workspace = parts.pop()!;
      this.connection = parts.pop()!;
      this.config = getConfig(this.connection);
      if (Object.keys(this.config).length === 0) throw buttonError;
      this.objectPath = joinPath(this.parentPath, this.name);
      this.parentFullPath = joinPath(
        "workspace",
        this.workspace,
        this.parentPath
      );
      this.objectFullPath = joinPath(this.parentFullPath, this.name);
      const isEditable = this.workspace.includes(
          `_${this.config.username.toLowerCase()}_`
        ),
        visibility = {
          push: isEditable,
          pushAll: isEditable && this.type !== "webtemp",
          search: this.type !== "webtemp",
          compare: true,
        } as const;
      setButtonVisibility(visibility);
      treeView.setActiveItem(
        this.type,
        this.objectFolderUri,
        this.name,
        this.parent
      );
    } catch (err: any) {
      setButtonVisibility(disableAllButtons);
    }
  };

  reparseFilePath = ({ files }: vscode.FileRenameEvent) => {
    const textEditor = vscode.window?.activeTextEditor;
    if (!textEditor) return;
    for (const { newUri } of files) {
      if (textEditor.document?.uri.path !== newUri.path) continue;
      return this.parseFilePath(textEditor);
    }
  };

  push = async () => {
    await this.document.save();
    const text = this.document.getText(),
      payload = { Name: this.name, [this.field]: text };
    if (isFileScript(this.ext)) {
      if (!isScriptNameValid(this.name, text))
        return vscode.window.showErrorMessage(error.nameDifferent);
      payload["Program Language"] = "JS";
    }
    const answer = await vscode.window.showInformationMessage(
      `Do you want to push ${this.name} to Siebel?`,
      ...pushNo
    );
    if (answer !== "Push") return;
    const result = await putObject(this.config, this.objectFullPath, payload);
    if (!result) return;
    vscode.window.showInformationMessage(
      `Successfully pushed ${this.name} to Siebel!`
    );
    treeView.setActiveItemState(itemStates.same);
    treeView.addChangeListener();
  };

  pushAll = async () => {
    const files = await getScriptsOnDisk(this.folderUri),
      payloads = [],
      invalid = [];
    for (const [fileName, fileExt] of files) {
      const fileUri = getFileUri(this.folderUri, fileName, fileExt),
        text = await readFile(fileUri),
        payload: Payload = {
          Name: fileName,
          Script: text,
          "Program Language": "JS",
        };
      payloads.push(payload);
      if (isScriptNameValid(fileName, text)) continue;
      invalid.push(fileName);
    }
    if (invalid.length > 0)
      return vscode.window.showErrorMessage(
        `Unable to push all, file and function names differ for the following script(s): ${invalid.join(
          ", "
        )}`
      );
    const answer = await vscode.window.showInformationMessage(
      `Do you want to push all scripts of ${this.parent} to Siebel?`,
      ...pushAllNo
    );
    if (answer !== "Push All") return;
    for (const payload of payloads) {
      const pushFullPath = joinPath(this.parentFullPath, payload.Name),
        result = await putObject(this.config, pushFullPath, payload);
      if (!result) return;
    }
    vscode.window.showInformationMessage(
      `Successfully pushed  all scripts of ${this.parent} to Siebel!`
    );
    treeView.setActiveParentItemState();
    treeView.addChangeListener();
  };

  newScript = async () => {
    const fileUri = await createNewScript(
      this.folderUri,
      this.defaultScripts,
      this.parent,
      this.config.fileExtension ?? "js"
    );
    await treeView.refreshBase(
      this.type,
      this.objectFolderUri,
      this.name,
      this.parent
    );
    if (fileUri) await openFile(fileUri);
  };

  search = async () => {
    const selection = this.editor!.selection,
      selected = selection.isEmpty
        ? this.document.getWordRangeAtPosition(selection.active)
        : selection,
      query = selected ? this.document.getText(selected) : "";
    await searchInFiles(this.folderUri, query);
  };

  compare = async () => {
    const { restWorkspaces } = this.config,
      items: vscode.QuickPickItem[] = [
        {
          label: this.workspace,
          description: "Compare in the same workspace",
        },
      ];
    if (restWorkspaces) {
      const data = await getObject(
        "allWorkspaces",
        this.config,
        paths.workspaces
      );
      while (data.length > 0) {
        const {
          Name: label,
          Status: description,
          RepositoryWorkspace,
        } = data.pop()!;
        if (RepositoryWorkspace) data.push(...RepositoryWorkspace);
        if (label === this.workspace) continue;
        items.push({ label, description });
      }
    } else {
      const workspaces = await getLocalWorkspaces(this.connection);
      for (const label of workspaces) {
        if (label === this.workspace) continue;
        items.push({ label });
      }
    }
    const answer = await vscode.window.showQuickPick(items, compareOptions);
    if (!answer) return;
    const { label } = answer,
      compareFullPath = joinPath("workspace", label, this.objectPath),
      response = await getObject(
        `compare${this.field}`,
        this.config,
        compareFullPath
      ),
      compareMessage = `Comparison of ${this.name} between ${label} and ${this.workspace} (on disk)`,
      state = await compareObjects(
        response,
        this.field,
        this.ext,
        this.document.uri,
        compareMessage
      );
    if (label !== this.workspace) return;
    treeView.setActiveItemState(state);
  };
}

export const activeEditor = ActiveEditor.getInstance();
