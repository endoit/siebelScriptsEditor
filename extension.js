const vscode = require('vscode');
<<<<<<< Updated upstream
const DBQuery = require('./dbQuery.js');
const filesRW = require('./filesRW.js');
const config = require('./config.js');
=======
const DBQuery = require ('./src/dbQuery.js');
const getData = require('./src/getData.js');
const TreeData = require('./src/TreeData.js');
const getWSRepo = require('./src/getWSRepo.js');
const config = require ('./config.js');
>>>>>>> Stashed changes

/**
 * @param {vscode.ExtensionContext} context
 */
<<<<<<< Updated upstream
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
=======
async function activate(context) {
	let wsrepo = await getData.getWSandRepoData();
	let workspaces = Object.keys(wsrepo.ws).map((item) => `<option value="${item}">`).join('');
	let repositories = Object.keys(wsrepo.repo).map((item) => `<option value="${item}">`).join('');
	let busServObj = {};
	const selected = {ws: "", repo: "", bs: ""};
	let disposable = vscode.commands.registerCommand('siebelScripteditor.helloWorld', async () => {
		const query = "SELECT * FROM SIEBEL.S_SERVICE WHERE CREATED < SYSDATE";
		DBQuery.dbQuery(query);
		vscode.window.showInformationMessage('Hello VSCODE from siebelScriptEditor!');
	});
	context.subscriptions.push(disposable);

	const HTMLPage = getWSRepo.HTMLPage(workspaces, repositories);

	const provider = { 
        resolveWebviewView: (thisWebview) => {
            thisWebview.webview.options = {enableScripts: true};
			thisWebview.webview.onDidReceiveMessage(async (message) => {
				selected.ws = wsrepo.ws[message.ws];
				selected.repo = wsrepo.repo[message.repo];
				vscode.window.showInformationMessage(`Selected Workspace: ${message.ws} Id: ${wsrepo.ws[message.ws]} and Repository: ${message.repo} Id: ${wsrepo.repo[message.repo]}`);
				busServObj = await getData.getBusinessServices(wsrepo.ws[message.ws], wsrepo.repo[message.repo]);
				const treeView = vscode.window.createTreeView('businessServices', {
					treeDataProvider: new TreeData.TreeDataProvider(busServObj)
				  });
				  treeView.onDidChangeSelection((e) => {selected.bs = busServObj[e.selection[0].label]});
				}, undefined, context.subscriptions);
				
            thisWebview.webview.html = HTMLPage;
        }
    };
	let webv = vscode.window.registerWebviewViewProvider('wsrepo', provider);
	context.subscriptions.push(webv);
}

function deactivate() {}
>>>>>>> Stashed changes

module.exports = {
	activate,
	deactivate
}
