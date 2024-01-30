import { existsSync } from "fs";
import * as vscode from "vscode";
import { WEBTEMP } from "./constants";

//write to file
export const writeFile = async (
  fileContent: string,
  relativePath: string,
  showDocument = false
): Promise<void> => {
  try {
    await vscode.workspace.saveAll(false);
    const filePath = vscode.Uri.file(
      `${vscode.workspace.workspaceFolders![0].uri.fsPath}/${relativePath}`
    );
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
    await vscode.workspace.applyEdit(wsEdit);
    const writeData = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(filePath, writeData);
    if (showDocument)
      await vscode.window.showTextDocument(filePath, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//write info.json
export const writeInfo = async (
  selected: Selected,
  folderPath: string,
  fileNames: string[]
): Promise<void> => {
  try {
    vscode.workspace.saveAll(false);
    let infoObj: ScriptInfo | WebTempInfo;
    const { object: type, connection, workspace } = selected,
      selectedObjName = selected[type].name,
      relativePath = `${folderPath}/${
        type !== WEBTEMP ? `${selectedObjName}/` : ""
      }info.json`,
      filePathString = `${
        vscode.workspace.workspaceFolders![0].uri.fsPath
      }/${relativePath}`,
      filePath = vscode.Uri.file(filePathString);
    if (existsSync(filePath.fsPath)) {
      //update info.json if exists
      const readData = await vscode.workspace.fs.readFile(filePath);
      infoObj = JSON.parse(Buffer.from(readData).toString());
      if (type !== WEBTEMP) {
        infoObj = infoObj as ScriptInfo;
        for (const fileName of fileNames) {
          infoObj.scripts[fileName] = {
            "last update from Siebel": new Date().toISOString(),
            "last push to Siebel": "",
          };
        }
      } else {
        infoObj = infoObj as WebTempInfo;
        infoObj.definitions[fileNames[0]] = {
          "last update from Siebel": new Date().toISOString(),
          "last push to Siebel": "",
        };
      }
    } else {
      //create info.json if not exists
      let infoObjBase: InfoObjectBase = {
        "folder created at": new Date().toISOString(),
        connection,
        workspace,
        type,
      };
      if (type !== WEBTEMP) {
        infoObj = infoObjBase as ScriptInfo;
        infoObj.siebelObjectName = selectedObjName;
        infoObj.scripts = {};
        for (const fileName of fileNames) {
          infoObj.scripts[fileName] = {
            "last update from Siebel": new Date().toISOString(),
            "last push to Siebel": "",
          };
        }
      } else {
        infoObj = infoObjBase as WebTempInfo;
        infoObj.definitions = {
          [fileNames[0]]: {
            "last update from Siebel": new Date().toISOString(),
            "last push to Siebel": "",
          },
        };
      }
    }
    writeFile( JSON.stringify(infoObj, null, 2), relativePath);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//copy index.d.ts and create jsconfig.json to the VSCode workspace folder if they do not exist
export const createIndexdtsAndJSConfigjson = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  try {
    const wsPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const typeDefFilePath = vscode.Uri.file(`${wsPath}/index.d.ts`);
    if (!existsSync(typeDefFilePath.fsPath)) {
      const data = await vscode.workspace.fs.readFile(
        vscode.Uri.file(context.asAbsolutePath("siebelTypes.txt"))
      );
      writeFile(data.toString(), "index.d.ts");
      vscode.window.showInformationMessage(
        `File index.d.ts was created in ${wsPath} folder!`
      );
    }
    const jsconfigFilePath = vscode.Uri.file(`${wsPath}/jsconfig.json`);
    if (!existsSync(jsconfigFilePath.fsPath)) {
      const jsConfig = JSON.stringify(
        { compilerOptions: { allowJs: true, checkJs: true } },
        null,
        2
      );
      writeFile(jsConfig, "jsconfig.json");
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${wsPath} folder!`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};
