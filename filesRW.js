const vscode = require('vscode');
const config = require('./config.js');

async function writeFiles(sData, wsName, bsName, fileName) {
  try {
    var bPath = true;
    var wsPath;
    //var wsName = "WS_FOLDER";
    //var bsName = "BS_FOLDER"
    //var fileName = "FGA_BS";

    if (config.workspace) {
      wsPath = config.workspace;
    } else if (vscode.workspace.workspaceFolders) {
      wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else { bPath = false; }

    // Create-Open files
    if (bPath) {
      const filePath = vscode.Uri.file(wsPath + '/' + wsName + '/' + bsName + '/' + fileName + '.js');
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);

      const writeData = Buffer.from(sData, 'utf8');
      vscode.workspace.fs.writeFile(filePath, writeData);


      vscode.window.showTextDocument(filePath);
      vscode.window.showInformationMessage('New files were created in directory: ./' + wsName + '/' + bsName);
    } else {
      vscode.window.showInformationMessage('Open a WorkSpace or define a WorkSpace path in config file');
    }
  } catch (err) {
    // send error message
    console.log(err.message);
    return err.message;
  }
}

exports.writeFiles = writeFiles;