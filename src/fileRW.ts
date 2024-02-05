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
    await vscode.window.showTextDocument(fileUri, { preview: openFile });
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
      dateInfoKey = isWebTemp ? "definitions" : "scripts",
      dateInfo = {
        "last update from Siebel": new Date().toISOString(),
        "last push to Siebel": "",
      };
    if (existsSync(filePath)) {
      //update info.json if exists
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      infoJSON = JSON.parse(Buffer.from(fileContent).toString());
      for (const fileName of fileNames) {
        if (infoJSON[dateInfoKey]!.hasOwnProperty(fileName))
          infoJSON[dateInfoKey]![fileName]["last update from Siebel"] =
            new Date().toISOString();
        else infoJSON[dateInfoKey]![fileName] = dateInfo;
      }
    } else {
      //create info.json if not exists
      infoJSON = {
        "folder created at": new Date().toISOString(),
        connection,
        workspace,
        type,
        [dateInfoKey]: {},
      };
      if (!isWebTemp) infoJSON.siebelObjectName = basename(folderPath);
      for (const fileName of fileNames) {
        infoJSON[dateInfoKey]![fileName] = dateInfo;
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
