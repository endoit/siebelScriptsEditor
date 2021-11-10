const vscode = require('vscode');
const filesRW = require('./src/filesRW.js');
//const config = require('./config.js');
const DBQuery = require ('./src/dbQuery.js');
const getData = require('./src/getData.js');
const TreeData = require('./src/TreeData.js');
const getWSRepo = require('./src/getWSRepo.js');

/**
 * @param {vscode.ExtensionContext} context
 */
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
	context.subscriptions.push(disposable2);

	const HTMLPage = getWSRepo.HTMLPage(workspaces, repositories);

	const provider = { 
        resolveWebviewView: (thisWebview) => {
            thisWebview.webview.options = {enableScripts: true};
			thisWebview.webview.onDidReceiveMessage(async (message) => {
				selected.ws = wsrepo.ws[message.ws];
				selected.repo = wsrepo.repo[message.repo];
				busServObj = await getData.getBusinessServices(wsrepo.ws[message.ws], wsrepo.repo[message.repo]);
				const treeView = vscode.window.createTreeView('businessServices', {
					treeDataProvider: new TreeData.TreeDataProvider(busServObj)
				  });
				  treeView.onDidChangeSelection((e) => {
					selected.bs = busServObj[e.selection[0].label];
					vscode.window.showInformationMessage(`Selected Workspace: ${message.ws} Id: ${wsrepo.ws[message.ws]} and Repository: ${message.repo} Id: ${wsrepo.repo[message.repo]} Business Service Name: ${e.selection[0].label} Id: ${selected.bs}`);
				});
				}, undefined, context.subscriptions);
				
            thisWebview.webview.html = HTMLPage;
        }
    };
	let webv = vscode.window.registerWebviewViewProvider('wsrepo', provider);
	context.subscriptions.push(webv);
}

function deactivate() {
	vscode.window.showInformationMessage('Accidently deactivated plugin :)');
}


module.exports = {
	activate,
	deactivate
}
