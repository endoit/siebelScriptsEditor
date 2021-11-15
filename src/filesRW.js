const vscode = require('vscode');
const config = require('../config.js');
//const fs = require('fs');

async function writeFiles(sData, wsName, bsName, fileName) {
  try {
    vscode.workspace.saveAll(false);
    var bPath = true;
    var wsPath;

    if (config.workspace) {
      wsPath = config.workspace;
    } else if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else { bPath = false; }

    // Create-Open files
    if (bPath) {
      var filePath = vscode.Uri.file(wsPath + '/' + wsName + '/' + bsName + '/' + fileName + '.js');
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);

      const writeData = Buffer.from(sData, 'utf8');
      vscode.workspace.fs.writeFile(filePath, writeData);

      await vscode.window.showTextDocument(filePath, { "preview": false });
      vscode.window.showInformationMessage('New files were created in directory: ./' + wsName + '/' + bsName);
    } else {
      vscode.window.showInformationMessage('Open a WorkSpace or define a WorkSpace path in config file');
    }
  } catch (err) {
    return err.message;
  }
}

async function writeInfo(aData, wsName, bsName) {
  try {
    vscode.workspace.saveAll(false);
    var bPath = true;
    var wsPath;

    if (config.workspace) {
      wsPath = config.workspace;
    } else if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else { bPath = false; }

    // Create-Open files
    if (bPath) {
      var oInfo = {
        "timestamp": new Date().toString(),
        "WSName": aData[0],
        "WSId": aData[1],
        "ObjName": aData[2],
        "ObjId": aData[3],
        "ObjectScripts": aData[4]
      }

      // Create if no file created yet
      const wsEdit = new vscode.WorkspaceEdit();
      var filePath = vscode.Uri.file(wsPath + '/' + wsName + '/' + bsName + '/' + 'INFO.json');
      wsEdit.createFile(filePath, { overwrite: false, ignoreIfExists: true });
      await vscode.workspace.applyEdit(wsEdit);

      // If file is empty then initialize
      var readData = await vscode.workspace.fs.readFile(filePath);
      var json;
      if (readData.length === 0) { json = []; }
      else { json = JSON.parse(Buffer.from(readData)); }
      json.push(oInfo)

      vscode.workspace.fs.writeFile(filePath, Buffer.from(JSON.stringify(json), 'utf8'));
      vscode.window.showTextDocument(filePath);

    } else {
      vscode.window.showInformationMessage('Open a WorkSpace or define a WorkSpace path in config file');
    }
  } catch (err) {
    return err.message;
  }
}

exports.writeFiles = writeFiles;
exports.writeInfo = writeInfo;