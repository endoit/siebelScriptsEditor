import { existsSync } from "fs";
import * as vscode from "vscode";
import {
  CONNECTION,
  FILE_NAME_INFO,
  FILE_NAME_JSCONFIG,
  OBJECT,
  FILE_NAME_TYPE_DEF,
  WEBTEMP,
  WORKSPACE,
  FILE_NAME_SIEBEL_TYPES,
  INFO_KEY_FOLDER_CREATED,
  INFO_KEY_LAST_UPDATE,
  INFO_KEY_LAST_PUSH,
} from "./constants";
import { GlobalState } from "./utility";
import { basename, join } from "path";

//write to file
export const writeFile = async (
  filePath: string,
  fileContent: string,
  openFile = false
): Promise<void> => {
  try {
    await vscode.workspace.saveAll(false);
    const fileUri = vscode.Uri.file(filePath),
      wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile(fileUri, { overwrite: true, ignoreIfExists: false });
    await vscode.workspace.applyEdit(wsEdit);
    const fileBuffer = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(fileUri, fileBuffer);
    if (openFile)
      await vscode.window.showTextDocument(fileUri, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//write info.json
export const writeInfo = async (
  folderPath: string,
  fileNames: string[],
  globalState: GlobalState
): Promise<void> => {
  try {
    vscode.workspace.saveAll(false);
    let infoJSON: InfoObject;
    const connection = globalState.get(CONNECTION),
      workspace = globalState.get(WORKSPACE),
      type = globalState.get(OBJECT),
      filePath = join(folderPath, FILE_NAME_INFO),
      fileUri = vscode.Uri.file(filePath),
      isWebTemp = type === WEBTEMP,
      oldDateInfoKey = isWebTemp ? "definitions" : "scripts",
      dateInfo = {
        [INFO_KEY_LAST_UPDATE]: new Date().toString(),
        [INFO_KEY_LAST_PUSH]: "",
      };
    if (existsSync(filePath)) {
      //update info.json if exists
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      infoJSON = JSON.parse(Buffer.from(fileContent).toString());
      if (infoJSON.hasOwnProperty(oldDateInfoKey)) {
        infoJSON.files = infoJSON[oldDateInfoKey]!;
        delete infoJSON[oldDateInfoKey];
      }
      for (const fileName of fileNames) {
        if (infoJSON.files.hasOwnProperty(fileName))
          infoJSON.files[fileName][INFO_KEY_LAST_UPDATE] =
            new Date().toString();
        else infoJSON.files[fileName] = dateInfo;
      }
    } else {
      //create info.json if not exists
      infoJSON = {
        [INFO_KEY_FOLDER_CREATED]: new Date().toString(),
        connection,
        workspace,
        type,
        files: {},
      };
      if (!isWebTemp) infoJSON.siebelObjectName = basename(folderPath);
      for (const fileName of fileNames) {
        infoJSON.files[fileName] = dateInfo;
      }
    }
    writeFile(filePath, JSON.stringify(infoJSON, null, 2));
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//copy index.d.ts and create jsconfig.json to the VSCode workspace folder if they do not exist
export const createIndexdtsAndJSConfigjson = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  try {
    const wsPath = vscode.workspace.workspaceFolders![0].uri.fsPath,
      typeDefFilePath = join(wsPath, FILE_NAME_TYPE_DEF),
      jsconfigFilePath = join(wsPath, FILE_NAME_JSCONFIG);
    if (!existsSync(typeDefFilePath)) {
      const data = await vscode.workspace.fs.readFile(
        vscode.Uri.file(context.asAbsolutePath(FILE_NAME_SIEBEL_TYPES))
      );
      writeFile(typeDefFilePath, data.toString());
      vscode.window.showInformationMessage(
        `File index.d.ts was created in ${wsPath} folder!`
      );
    }

    if (!existsSync(jsconfigFilePath)) {
      const jsConfig = JSON.stringify(
        { compilerOptions: { allowJs: true, checkJs: true } },
        null,
        2
      );
      writeFile(jsconfigFilePath, jsConfig);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${wsPath} folder!`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
