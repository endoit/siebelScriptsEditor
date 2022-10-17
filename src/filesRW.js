const vscode = require("vscode");
const fs = require("fs");

//create method files for siebel objects
const writeFiles = async (sData, folderPath, objectName, fileName) => {
  try {
    vscode.workspace.saveAll(false);
    let bPath = true;
    let wsPath;
    let filePath;

    if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      bPath = false;
    }

    if (bPath) {
      filePath = fileName
        ? vscode.Uri.file(`${wsPath}/${folderPath}/${objectName}/${fileName}.js`)
        : vscode.Uri.file(`${wsPath}/${folderPath}/${objectName}.html`);
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);

      const writeData = Buffer.from(sData, "utf8");
      vscode.workspace.fs.writeFile(filePath, writeData);

      await vscode.window.showTextDocument(filePath, { "preview": false });
      vscode.window.showInformationMessage(`New files were created in directory: ./${folderPath}${fileName ? "/" + objectName : ""}`);

    } else {
      vscode.window.showInformationMessage("Please open a workspace folder!");
    }
  } catch (err) {
    return err.message;
  }
}

//write info.json
const writeInfo = async (selectedObj, folderPath, type, methodNames) => {
  try {
    vscode.workspace.saveAll(false);
    let bPath = true;
    let wsPath;
    let infoObj;
    let wsEdit;
    let filePathString;
    let filePath;
    let readData;
    let scrname;

    if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      bPath = false;
    }
    if (bPath) {
      filePathString = `${wsPath}/${folderPath}/${type !== "webtemp" ? selectedObj[type].name + "/" : ""}info.json`;
      filePath = vscode.Uri.file(filePathString);
      if (fs.existsSync(filePath.fsPath)) {
        //update info.json if exists
        readData = await vscode.workspace.fs.readFile(filePath);
        infoObj = JSON.parse(Buffer.from(readData));
        if (type !== "webtemp") {
          for (scrname of methodNames) {
            infoObj.scripts[scrname] = { "last update from Siebel": new Date().toString(), "last push to Siebel": "" };
          }
        } else {
          infoObj.definitions[methodNames] = { "last update from Siebel": new Date().toString(), "last push to Siebel": "" };
        }
        vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), "utf8"));
      } else {
        //create info.json if not exists
        infoObj = {
          "folder created at": new Date().toString(),
          "connection": selectedObj.connection,
          "workspace": selectedObj.workspace,
          "type": type
        }
        if (type !== "webtemp") {
          infoObj.siebelObjectName = selectedObj[type].name,
            infoObj.scripts = {};
          for (scrname of methodNames) {
            infoObj.scripts[scrname] = { "last update from Siebel": new Date().toString(), "last push to Siebel": "" };
          }
        } else {
          infoObj.definitions = {};
          infoObj.definitions[methodNames] = { "last update from Siebel": new Date().toString(), "last push to Siebel": "" };
        }
        wsEdit = new vscode.WorkspaceEdit();
        wsEdit.createFile(filePath, { overwrite: false, ignoreIfExists: true });
        await vscode.workspace.applyEdit(wsEdit);
        vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), "utf8"));
      }
    } else {
      vscode.window.showErrorMessage("Please open a workspace folder!");
    }
  } catch (err) {
    return err.message;
  }
}

//copy index.d.ts and create jsconfig.json to the VSCode workspace folder if they do not exist
const copyTypeDefFile = async (context) => {
  try {
    const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const wsEdit = new vscode.WorkspaceEdit();
    const typeDefFilePath = vscode.Uri.file(`${wsPath}/index.d.ts`);
    if (!fs.existsSync(typeDefFilePath.fsPath)) {
      const data = await vscode.workspace.fs.readFile(
        vscode.Uri.file(context.asAbsolutePath("src/index.d.ts"))
      );
      wsEdit.createFile(typeDefFilePath, { ignoreIfExists: true });
      await vscode.workspace.fs.writeFile(typeDefFilePath, data);
      await vscode.workspace.applyEdit(wsEdit);
      vscode.window.showInformationMessage(`File index.d.ts was created in ${wsPath} folder!`);
    }
    const jsconfigFilePath = vscode.Uri.file(`${wsPath}/jsconfig.json`);
    if (!fs.existsSync(jsconfigFilePath.fsPath)) {
      const jsConfig = {"compilerOptions": {"allowJs": true, "checkJs": true }};
      wsEdit.createFile(jsconfigFilePath, { ignoreIfExists: true });
      await vscode.workspace.fs.writeFile(jsconfigFilePath, Buffer.from(JSON.stringify(jsConfig, null, 2), "utf8"));
      await vscode.workspace.applyEdit(wsEdit);
      vscode.window.showInformationMessage(`File jsconfig.json was created in ${wsPath} folder!`)
    }
  } catch (err) {
    vscode.window.showErrorMessage(err.message);
  }
}

exports.writeFiles = writeFiles;
exports.writeInfo = writeInfo;
exports.copyTypeDefFile = copyTypeDefFile;
