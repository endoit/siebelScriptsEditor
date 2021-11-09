// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const DBQuery = require('./dbQuery.js');
const filesRW = require('./filesRW.js');
const config = require('./config.js');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "siebelscripteditor" is now active!');


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('siebelscripteditor.helloWorld', function () {
		// The code you place here will be executed every time your command is executed
		//const query = "SELECT * FROM SIEBEL.S_SERVICE WHERE WS_ID = '1-974CY5'";
		const query = "SELECT * FROM SIEBEL.S_SERVICE";
		var result = DBQuery.dbQuery(query);
		console.log(result)
		//TESZT
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello VSCODE from siebelscriptEditor!');
	});

	let disposable2 = vscode.commands.registerCommand('siebelscripteditor.openFile', async function () {
		var wsName = "WS_FOLDER"; //TEST
		var bsName = "BS_FOLDER" //TEST
		
		var sWSId = "1-974CY5";
		var sBSId = "1-974CYF";
		const query = "SELECT * FROM SIEBEL.S_SERVICE_SCRPT WHERE SERVICE_ID = '" + sBSId + "' AND WS_ID = '" + sWSId + "'";
		var result = await DBQuery.dbQuery(query);
		console.log(result)
		for (var x in result.rows) {
			let sData = result.rows[x].SCRIPT;
			let sMethodName = result.rows[x].NAME;
			filesRW.writeFiles(sData, wsName, bsName, sMethodName);
		}

		
	});

	// Display a message box to the user
	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
}

// this method is called when your extension is deactivated
function deactivate() {
	vscode.window.showInformationMessage('Accidently deactivated plugin :)');
}

module.exports = {
	activate,
	deactivate
}
