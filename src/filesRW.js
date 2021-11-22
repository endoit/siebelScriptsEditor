const vscode = require('vscode');
const fs = require('fs');

//create method files for siebel objects
const writeFiles = async (sData, wsName, bsName, fileName, backup) => {
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
      filePath = vscode.Uri.file(wsPath + '/' + wsName + '/' + bsName + '/' + fileName + '.js');
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);

      const writeData = Buffer.from(sData, 'utf8');
      vscode.workspace.fs.writeFile(filePath, writeData);

      if (!backup) {
        await vscode.window.showTextDocument(filePath, { "preview": false });
        vscode.window.showInformationMessage('New files were created in directory: ./' + wsName + '/' + bsName);
      }
    } else {
      vscode.window.showInformationMessage('Open a WorkSpace or define a WorkSpace path in config file');
    }
  } catch (err) {
    return err.message;
  }
}

//write info.json
const writeInfo = async (selectedObj, folderObj, folderPath, type, methodName) => {
  try {
    vscode.workspace.saveAll(false);
    let bPath = true;
    let wsPath;
    let infoObj;
    let wsEdit;
    let filePath;
    let readData;
    let scrname;
    let scrid;
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
        for ([scrname, scrid] of Object.entries(methodName)) {
          infoObj.scripts[scrname] = { "id": scrid, "last update from database": new Date().toString(), "last push to database": "" }
        }
        vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), 'utf8'));
      } else {
        //create info.json if not exists
        infoObj = {
          "folder created at": new Date().toString(),
          "db": folderObj.db,
          "repo": { "name": folderObj.repo, "id": selectedObj.repo },
          "ws": { "name": folderObj.ws, "id": selectedObj.ws },
          "type": type,
          "siebelObject": { "name": selectedObj[type].name, "id": selectedObj[type].id },
          "scripts": {}
        }
        for ([scrname, scrid] of Object.entries(methodName)) {
          infoObj.scripts[scrname] = { "id": scrid, "last update from database": new Date().toString(), "last push to database": "" }
        }
        wsEdit = new vscode.WorkspaceEdit();
        wsEdit.createFile(filePath, { overwrite: false, ignoreIfExists: true });
        await vscode.workspace.applyEdit(wsEdit);
        vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), 'utf8'));
      }
    } else if (bPath && type === "backup") {
      //create backupinfo.json
      filePath = vscode.Uri.file(`${wsPath}/${folderPath}/backupinfo.json`);
      infoObj = {
        "backup created at": new Date().toString(),
        "db": folderObj.db,
        "repo": { "name": folderObj.repo, "id": selectedObj.repo },
        "ws": { "name": folderObj.ws.split("_backup_")[0], "id": selectedObj.ws }
      }
      wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);
      vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(infoObj, null, 2), 'utf8'));
    } else {
      vscode.window.showInformationMessage('Open a WorkSpace or define a WorkSpace path in config file');
    }
  } catch (err) {
    return err.message;
  }
}

exports.writeFiles = writeFiles;
exports.writeInfo = writeInfo;
