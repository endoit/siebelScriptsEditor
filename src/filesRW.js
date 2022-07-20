const vscode = require("vscode");
const fs = require("fs");

//create method files for siebel objects
const writeFiles = async (sData, folderPath, objectName, fileName) => {
  try {
    vscode.workspace.saveAll(false);
    let bPath = true;
    let wsPath;
    let filePath;

    /*if (config.workspace) {
      wsPath = config.workspace;
    } else */
    if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      bPath = false;
    }

    if (bPath) {
      filePath = vscode.Uri.file(`${wsPath}/${folderPath}/${objectName}/${fileName}.js`);
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);

      const writeData = Buffer.from(sData, "utf8");
      vscode.workspace.fs.writeFile(filePath, writeData);

      await vscode.window.showTextDocument(filePath, { "preview": false });
      vscode.window.showInformationMessage(`New files were created in directory: ./${folderPath}/${objectName}`);
      
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
    let filePath;
    let readData;
    let scrname;
    /*if (config.workspace) {
      wsPath = config.workspace;
    } else*/
    if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
      bPath = false;
    }
    if (bPath && type !== "backup") {
      filePath = vscode.Uri.file(`${wsPath}/${folderPath}/${selectedObj[type].name}/info.json`);
      if (fs.existsSync(`${wsPath}/${folderPath}/${selectedObj[type].name}/info.json`)) {
        //update info.json if exists
        readData = await vscode.workspace.fs.readFile(filePath);
        infoObj = JSON.parse(Buffer.from(readData));
        for (scrname of methodNames) {
          infoObj.scripts[scrname] = { "last update from database": new Date().toString(), "last push to database": "" }
        }
        vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), "utf8"));
      } else {
        //create info.json if not exists
        infoObj = {
          "folder created at": new Date().toString(),
          "connection": selectedObj.connection,
          "workspace": selectedObj.workspace,
          "type": type,
          "siebelObjectName": selectedObj[type].name,
          "scripts": {}
        }
        for (scrname of methodNames) {
          infoObj.scripts[scrname] = { "last update from Siebel": new Date().toString(), "last push to Siebel": "" }
        }
        wsEdit = new vscode.WorkspaceEdit();
        wsEdit.createFile(filePath, { overwrite: false, ignoreIfExists: true });
        await vscode.workspace.applyEdit(wsEdit);
        vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), "utf8"));
      }
    } else {
      vscode.window.showInformationMessage("Open a WorkSpace folder!");
    }
  } catch (err) {
    return err.message;
  }
}

exports.writeFiles = writeFiles;
exports.writeInfo = writeInfo;
