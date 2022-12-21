import { existsSync } from "fs";
import * as vscode from "vscode";
import { WEBTEMP } from "./constants";

//create method files for siebel objects
export const writeFiles = async (
  fileContent: string,
  folderPath: string,
  objectName: string,
  fileName?: string
): Promise<void> => {
  try {
    await vscode.workspace.saveAll(false);
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath!;
    const filePath = vscode.Uri.file(
      `${wsPath}/${folderPath}/${objectName}${
        fileName !== undefined ? `/${fileName}.js` : ".html"
      }`
    );
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
    await vscode.workspace.applyEdit(wsEdit);
    const writeData = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(filePath, writeData);
    await vscode.window.showTextDocument(filePath, { preview: false });
    vscode.window.showInformationMessage(
      `New files were created in directory: ./${folderPath}${
        fileName ? `/${objectName}` : ""
      }`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//write info.json
export const writeInfo = async (
  selectedObj: Selected,
  folderPath: string,
  type: SiebelObject,
  fileNames: string[]
): Promise<void> => {
  try {
    vscode.workspace.saveAll(false);
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath!;
    let infoObj: ScriptInfo | WebTempInfo;
    let fileName: string;
    const filePathString = `${wsPath}/${folderPath}/${
      type !== WEBTEMP ? `${selectedObj[type].name}/` : ""
    }info.json`;
    const filePath = vscode.Uri.file(filePathString);
    if (existsSync(filePath.fsPath)) {
      //update info.json if exists
      const readData = await vscode.workspace.fs.readFile(filePath);
      infoObj = JSON.parse(Buffer.from(readData).toString());
      if (type !== WEBTEMP) {
        infoObj = infoObj as ScriptInfo;
        for (fileName of fileNames) {
          infoObj.scripts[fileName] = {
            "last update from Siebel": new Date().toString(),
            "last push to Siebel": "",
          };
        }
      } else {
        infoObj = infoObj as WebTempInfo;
        infoObj.definitions[fileNames[0]] = {
          "last update from Siebel": new Date().toString(),
          "last push to Siebel": "",
        };
      }
      await vscode.workspace.fs.writeFile(
        filePath,
        Buffer.from(JSON.stringify(infoObj, null, 2), "utf8")
      );
    } else {
      //create info.json if not exists
      let infoObjBase: InfoObjectBase = {
        "folder created at": new Date().toString(),
        connection: selectedObj.connection,
        workspace: selectedObj.workspace,
        type: type,
      };
      if (type !== WEBTEMP) {
        infoObj = infoObjBase as ScriptInfo;
        infoObj.siebelObjectName = selectedObj[type].name;
        infoObj.scripts = {};
        for (fileName of fileNames) {
          infoObj.scripts[fileName] = {
            "last update from Siebel": new Date().toString(),
            "last push to Siebel": "",
          };
        }
      } else {
        infoObj = infoObjBase as WebTempInfo;
        infoObj.definitions = {};
        infoObj.definitions[fileNames[0]] = {
          "last update from Siebel": new Date().toString(),
          "last push to Siebel": "",
        };
      }
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: false, ignoreIfExists: true });
      await vscode.workspace.applyEdit(wsEdit);
      await vscode.workspace.fs.writeFile(
        filePath,
        Buffer.from(JSON.stringify(infoObj, null, 2), "utf8")
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//copy index.d.ts and create jsconfig.json to the VSCode workspace folder if they do not exist
export const copyTypeDefFile = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  try {
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath!;
    const wsEdit = new vscode.WorkspaceEdit();
    const typeDefFilePath = vscode.Uri.file(`${wsPath}/index.d.ts`);
    if (!existsSync(typeDefFilePath.fsPath)) {
      const data = await vscode.workspace.fs.readFile(
        vscode.Uri.file(context.asAbsolutePath("siebelTypes.txt"))
      );
      wsEdit.createFile(typeDefFilePath, { ignoreIfExists: true });
      await vscode.workspace.fs.writeFile(typeDefFilePath, data);
      await vscode.workspace.applyEdit(wsEdit);
      vscode.window.showInformationMessage(
        `File index.d.ts was created in ${wsPath} folder!`
      );
    }
    const jsconfigFilePath = vscode.Uri.file(`${wsPath}/jsconfig.json`);
    if (!existsSync(jsconfigFilePath.fsPath)) {
      const jsConfig = { compilerOptions: { allowJs: true, checkJs: true } };
      wsEdit.createFile(jsconfigFilePath, { ignoreIfExists: true });
      await vscode.workspace.fs.writeFile(
        jsconfigFilePath,
        Buffer.from(JSON.stringify(jsConfig, null, 2), "utf8")
      );
      await vscode.workspace.applyEdit(wsEdit);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${wsPath} folder!`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err?.message);
  }
};
