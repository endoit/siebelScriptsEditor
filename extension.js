const vscode = require('vscode');
const filesRW = require('./src/filesRW.js');
const config = require('./config.js');
const DBQuery = require ('./src/dbQuery.js');
const getData = require('./src/getData.js');
const TreeData = require('./src/TreeData.js');
const getHTML = require('./src/getHTML.js');

async function activate(context) {
	const selected = {db: Object.keys(config.DBConnection)[0], ws: "", repo: "", bs: "", bc: "", applet: "", application: ""};
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
		var bsName = "BS_FOLDER" //TEST
		
		var sWSId = "1-974CY5";
		var sBSId = "1-974CYF";
		const query = "SELECT * FROM SIEBEL.S_SERVICE_SCRPT WHERE SERVICE_ID = '" + sBSId + "' AND WS_ID = '" + sWSId + "'";
		var result = await DBQuery.dbQuery(query, selected.db);
		console.log(result)
		for (var x in result.rows) {
			let sData = result.rows[x].SCRIPT;
			let sMethodName = result.rows[x].NAME;
			filesRW.writeFiles(sData, wsName, bsName, sMethodName);
		}
	});
	context.subscriptions.push(disposable2);

	let pullButton = vscode.commands.registerCommand('siebelscripteditor.pullScript', async function () {
		answer = await vscode.window.showInformationMessage("Do you want to overwrite the current script from the Siebel database?", ...["Yes", "No"]);
		if (answer === "Yes"){
			console.log("Yes");
		}
	}
	)
	context.subscriptions.push(pullButton);
	let pushButton = vscode.commands.registerCommand('siebelscripteditor.pushScript', async function () {
		answer = await vscode.window.showInformationMessage("Do you want to overwrite this script in the Siebel database?", ...["Yes", "No"]);
		if (answer === "Yes"){
			console.log("Yes");
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
						selected.db = message.db;
						vscode.window.showInformationMessage(`Selected database: ${selected.db}`);
						dbRepoWS.repo = await getData.getRepoData(selected.db);
						dbRepoWS.ws = await getData.getWSData(dbRepoWS.repo["Siebel Repository"], selected.db);
						thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, "Siebel Repository", "MAIN");
						break;
					}
					case "selectRepo": {
						selected.repo = dbRepoWS.repo[message.repo];
						vscode.window.showInformationMessage(`Selected repository: ${message.repo}`);
						dbRepoWS.ws = await getData.getWSData(selected.repo, selected.db);
						thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, message.repo, "MAIN");
						break;
					}
					case "selectWS": {
						selected.repo = dbRepoWS.repo[message.repo];
						selected.ws = dbRepoWS.ws[message.ws];
						vscode.window.showInformationMessage(`Selected repository: ${message.ws}`);
						busServObj = await getData.getSiebelData(selected.ws, selected.repo, "S_SERVICE", selected.db);
						console.log(selected)
						const treeDataBS = new TreeData.TreeDataProvider(busServObj);
						const treeViewBS = vscode.window.createTreeView('businessServices', {
							treeDataProvider: treeDataBS
						});
						treeViewBS.onDidChangeSelection(async (e) => {
							selected.bs = busServObj[e.selection[0].label].id;
							answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} business service from the Siebel database?`, ...["Yes", "No"]);
							if (answer === "Yes"){
								busServObj[e.selection[0].label].onDisk = true;
								treeDataBS.refresh(busServObj);
							}
						});
						busCompObj = await getData.getSiebelData(selected.ws, selected.repo, "S_BUSCOMP", selected.db);
						const treeDataBC = new TreeData.TreeDataProvider(busCompObj);
						const treeViewBC = vscode.window.createTreeView('businessComponents', {
							treeDataProvider: treeDataBC
						});
						treeViewBC.onDidChangeSelection(async (e) => {
							selected.bc = busCompObj[e.selection[0].label].id;
							answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} business component from the Siebel database?`, ...["Yes", "No"]);
							if (answer === "Yes"){
								busCompObj[e.selection[0].label].onDisk = true;
								treeDataBC.refresh(busCompObj);
							}
						});
						appletObj = await getData.getSiebelData(selected.ws, selected.repo, "S_APPLET", selected.db);
						const treeDataApplet = new TreeData.TreeDataProvider(appletObj);
						const treeViewApplet = vscode.window.createTreeView('applets', {
							treeDataProvider: treeDataApplet
						});
						treeViewApplet.onDidChangeSelection(async (e) => {
							selected.applet = appletObj[e.selection[0].label].id;
							answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} from the Siebel database?`, ...["Yes", "No"]);
							if (answer === "Yes"){
								appletObj[e.selection[0].label].onDisk = true;
								treeDataApplet.refresh(appletObj);
							}
						});
						applicationObj = await getData.getSiebelData(selected.ws, selected.repo, "S_APPLICATION", selected.db);
						const treeDataApplication = new TreeData.TreeDataProvider(applicationObj);
						const treeViewApplication = vscode.window.createTreeView('applications', {
							treeDataProvider: treeDataApplication
						});
						treeViewApplication.onDidChangeSelection(async (e) => {
							selected.application = applicationObj[e.selection[0].label].id;
							answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} application from the Siebel database?`, ...["Yes", "No"]);
							if (answer === "Yes"){
								applicationObj[e.selection[0].label].onDisk = true;
								treeDataApplication.refresh(applicationObj);
							}
						});
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
