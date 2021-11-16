const vscode = require('vscode');
const filesRW = require('./src/filesRW.js');
const config = require('./config.js');
const DBQuery = require ('./src/dbQuery.js');
const getData = require('./src/getData.js');
const TreeData = require('./src/TreeData.js');
const getHTML = require('./src/getHTML.js');

async function activate(context) {
	const selected = {date: "", scr: "", db: Object.keys(config.DBConnection)[0], ws: "", repo: "", service: {id: "", name: "", childId: ""}, buscomp: {id: "", name: "", childId: ""}, applet: {id: "",  name: "", childId: ""}, application: {id: "",  name: "", childId: ""}};
	const folders = {db: Object.keys(config.DBConnection)[0], repo: "", ws: ""};
	const folderPath = () => `${folders.db}_${folders.repo}/${folders.ws}`;
	const dbRepoWS = {db: "", repo: "", ws: ""}
	dbRepoWS.db = config.DBConnection;
	dbRepoWS.repo = await getData.getRepoData(selected.db);	
	dbRepoWS.ws = await getData.getWSData(dbRepoWS.repo["Siebel Repository"], selected.db);
	let busServObj = {};
	let busCompObj = {};
	let appletObj = {};
	let applicationObj = {};
	let answer;

	let disposable = vscode.commands.registerCommand('siebelScripteditor.helloWorld', async () => {
		const query = "SELECT * FROM SIEBEL.S_SERVICE WHERE CREATED < SYSDATE";
		DBQuery.dbQuery(query, selected.db);
		vscode.window.showInformationMessage('Hello VSCODE from siebelScriptEditor!');
	});
	context.subscriptions.push(disposable);

	let disposable2 = vscode.commands.registerCommand('siebelscripteditor.openFile', async function () {
		var wsName = "WS_FOLDER"; //TEST
		var bsName = "BS_FOLDER"; //TEST

		var sWSId = "1-974CY5";
		var sBSId = "1-974CYF";
		const query = "SELECT * FROM SIEBEL.S_SERVICE_SCRPT WHERE SERVICE_ID = '" + sBSId + "' AND WS_ID = '" + sWSId + "'";
		var result = await DBQuery.dbQuery(query, selected.db);
		var aMethodNames = [];
		console.log(result)
		for (var x in result.rows) {
			let sData = result.rows[x].SCRIPT;
			let sMethodName = result.rows[x].NAME;
			aMethodNames.push(sMethodName);
			filesRW.writeFiles(sData, wsName, bsName, sMethodName);
		}
		var aInfos = [wsName, sWSId, bsName, sBSId, aMethodNames]
		filesRW.writeInfo(aInfos, wsName, bsName);
	});
	context.subscriptions.push(disposable2);

	let pullButton = vscode.commands.registerCommand('siebelscripteditor.pullScript', async function () {

		answer = await vscode.window.showInformationMessage("Do you want to overwrite the current script from the Siebel database?", ...["Yes", "No"]);
		if (answer === "Yes"){
			//let currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
			/*vscode.window.showInformationMessage(currentlyOpenTabfilePath);
			//console.log(vscode.Uri.file(asd[0]))*/
		}
	}
	)
	context.subscriptions.push(pullButton);
	let pushButton = vscode.commands.registerCommand('siebelscripteditor.pushScript', async function () {
		answer = await vscode.window.showInformationMessage("Do you want to overwrite this script in the Siebel database?", ...["Yes", "No"]);
		if (answer === "Yes"){
		}
	}
	)
	context.subscriptions.push(pushButton);
	const provider = { 
		resolveWebviewView: (thisWebview) => {
			thisWebview.webview.options = {enableScripts: true};
			thisWebview.webview.onDidReceiveMessage(async (message) => {
				switch (message.command){
					case "selectDB": {
						folders.db = message.db;
						selected.db = message.db;
						vscode.window.showInformationMessage(`Selected database: ${selected.db}`);
						dbRepoWS.repo = await getData.getRepoData(selected.db);
						dbRepoWS.ws = await getData.getWSData(dbRepoWS.repo["Siebel Repository"], selected.db);
						thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, "Siebel Repository", "MAIN");
						break;
					}
					case "selectRepo": {
						folders.repo = message.repo;
						selected.repo = dbRepoWS.repo[message.repo];
						vscode.window.showInformationMessage(`Selected repository: ${message.repo}`);
						dbRepoWS.ws = await getData.getWSData(selected.repo, selected.db);
						thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, message.repo, "MAIN");
						break;
					}
					case "selectWS": {
						folders.repo = message.repo
						folders.ws = message.ws
						selected.date = message.date
						selected.scr = message.scr;
						selected.repo = dbRepoWS.repo[message.repo];
						selected.ws = dbRepoWS.ws[message.ws];
						vscode.window.showInformationMessage(`Selected repository: ${message.ws}`);
						busServObj = await getData.getSiebelData(selected, "service", folderPath());
						const treeDataBS = new TreeData.TreeDataProvider(busServObj);
						const treeViewBS = vscode.window.createTreeView('businessServices', {
							treeDataProvider: treeDataBS
						});
						treeViewBS.onDidChangeSelection(async (e) => TreeData.selectionChange(e, "service", selected, busServObj, treeDataBS, folders));
						
						busCompObj = await getData.getSiebelData(selected, "buscomp", folderPath());
						const treeDataBC = new TreeData.TreeDataProvider(busCompObj);
						const treeViewBC = vscode.window.createTreeView('businessComponents', {
							treeDataProvider: treeDataBC
						});
						treeViewBC.onDidChangeSelection(async (e) => TreeData.selectionChange(e, "buscomp", selected, busCompObj, treeDataBC, folders));
						
						appletObj = await getData.getSiebelData(selected, "applet", folderPath());
						const treeDataApplet = new TreeData.TreeDataProvider(appletObj);
						const treeViewApplet = vscode.window.createTreeView('applets', {
							treeDataProvider: treeDataApplet
						});
						treeViewApplet.onDidChangeSelection(async (e) => TreeData.selectionChange(e, "applet", selected, appletObj, treeDataApplet, folders));
						
						applicationObj = await getData.getSiebelData(selected, "application", folderPath());
						const treeDataApplication = new TreeData.TreeDataProvider(applicationObj);
						const treeViewApplication = vscode.window.createTreeView('applications', {
							treeDataProvider: treeDataApplication
						});
						treeViewApplication.onDidChangeSelection(async (e) => TreeData.selectionChange(e, "application", selected, applicationObj, treeDataApplication, folders));
						break;
					}
				}	
			}, undefined, context.subscriptions);
			thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, "DEVDB", "Siebel Repository", "MAIN");
		}
	};
	let selectBox = vscode.window.registerWebviewViewProvider('wsrepo', provider);
	context.subscriptions.push(selectBox);
}

function deactivate() {
	vscode.window.showInformationMessage('Accidently deactivated plugin :)');
}


module.exports = {
	activate,
	deactivate
}
