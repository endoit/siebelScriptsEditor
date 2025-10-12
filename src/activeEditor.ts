import * as vscode from "vscode";
import {
  buttonError,
  compareOptions,
  error,
  paths,
  pushNo,
  pushAllNo,
  fields,
  itemStates,
  disableAllButtons,
  scriptMeta,
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
  isTypeScript,
  isTypeWebTemp,
  isWorkspaceEditable,
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
  private declare config: Config;
  private declare field: Field;
  private declare parentPath: string;
  private declare isTreeActive: boolean;

  private constructor() {}

  static getInstance() {
    ActiveEditor.instance ??= new ActiveEditor();
    return ActiveEditor.instance;
  }

  parseFilePath = async (textEditor: vscode.TextEditor | undefined) => {
    try {
      this.editor = textEditor;
      if (!this.editor) throw buttonError;
      this.document = this.editor.document;
      this.folderUri = vscode.Uri.joinPath(this.document.uri, "..");
      const parts = this.document.uri.path.split("/");
      [this.name, this.ext] = <[string, FileExt]>parts.pop()!.split(".");
      if (!this.name) throw buttonError;
      const isScript = isFileScript(this.ext);
      if (isScript && parts.length > 4) {
        this.parent = parts.pop()!;
        const type = parts.pop()!;
        if (!isTypeScript(type)) throw buttonError;
        this.type = type;
        this.field = fields.script;
        this.parentPath = joinPath(
          this.type,
          this.parent,
          scriptMeta[this.type].path
        );
      } else if (isFileWebTemp(this.ext) && parts.length > 3) {
        this.parent = "";
        const type = parts.pop()!;
        if (!isTypeWebTemp(type)) throw buttonError;
        this.type = type;
        this.field = fields.definition;
        this.parentPath = this.type;
      } else throw buttonError;
      this.workspace = parts.pop()!;
      this.config = getConfig(parts.pop()!);
      if (Object.keys(this.config).length === 0) throw buttonError;
      this.isTreeActive =
        treeView.connection === this.config.name &&
        treeView.workspace === this.workspace;
      const isEditable = isWorkspaceEditable(this.workspace, this.config),
        visibility = {
          push: isEditable,
          pushAll: isEditable && isScript,
          search: isScript,
          compare: true,
        } as const;
      setButtonVisibility(visibility);
      if (!this.isTreeActive) {
        treeView.activeItem = undefined;
        return;
      }
      await treeView.setActiveItem(this.type, this.name, this.parent);
    } catch (err: any) {
      this.isTreeActive = false;
      setButtonVisibility(disableAllButtons);
      treeView.activeItem = undefined;
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
    const content = this.document.getText(),
      payload = { Name: this.name, [this.field]: content };
    if (isFileScript(this.ext)) {
      if (!isScriptNameValid(this.name, content))
        return vscode.window.showErrorMessage(error.nameDifferent);
      payload["Program Language"] = "JS";
    }
    const answer = await vscode.window.showInformationMessage(
      `Do you want to push ${this.name} to Siebel?`,
      ...pushNo
    );
    if (answer !== "Push") return;
    const path = joinPath(
        "workspace",
        this.workspace,
        this.parentPath,
        this.name
      ),
      result = await putObject(this.config, path, payload);
    if (!result) return;
    vscode.window.showInformationMessage(
      `Successfully pushed ${this.name} to Siebel!`
    );
    treeView.activeItemState = itemStates.same;
  };

  pushAll = async () => {
    const files = await getScriptsOnDisk(this.folderUri),
      invalid: string[] = [],
      payloads = await Promise.all(
        [...files].map(async ([fileName, fileExt]) => {
          const fileUri = getFileUri(this.folderUri, fileName, fileExt),
            content = await readFile(fileUri);
          if (!isScriptNameValid(fileName, content)) invalid.push(fileName);
          return <Payload>{
            Name: fileName,
            Script: content,
            "Program Language": "JS",
          };
        })
      );
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
      const path = joinPath(
          "workspace",
          this.workspace,
          this.parentPath,
          payload.Name
        ),
        result = await putObject(this.config, path, payload);
      if (!result) return;
    }
    vscode.window.showInformationMessage(
      `Successfully pushed  all scripts of ${this.parent} to Siebel!`
    );
    treeView.activeObjectState = itemStates.same;
  };

  newScript = async () => {
    const fileUri = await createNewScript(
      this.folderUri,
      <Script>this.type,
      this.parent,
      this.config.fileExtension
    );
    if (!fileUri) return;
    await openFile(fileUri);
    await treeView.reveal();
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
    const items: vscode.QuickPickItem[] = [
      {
        label: this.workspace,
        description: "Compare in the same workspace",
      },
    ];
    if (this.config.restWorkspaces) {
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
      const workspaces = await getLocalWorkspaces(this.config.name);
      for (const label of workspaces) {
        if (label === this.workspace) continue;
        items.push({ label });
      }
    }
    const answer = await vscode.window.showQuickPick(items, compareOptions);
    if (!answer) return;
    const { label } = answer,
      path = joinPath("workspace", label, this.parentPath, this.name),
      response = await getObject(`compare${this.field}`, this.config, path),
      content = response[0]?.[this.field],
      compareMessage = `Comparison of ${this.name} between ${label} and ${this.workspace} (on disk)`,
      state = await compareObjects(
        content,
        this.ext,
        this.document.uri,
        compareMessage
      );
    if (label !== this.workspace) return;
    treeView.activeItemState = state;
  };
}

export const activeEditor = ActiveEditor.getInstance();
