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
	let busCompObj = {};
	let appletObj = {};
	let applicationObj = {};
	const selected = {ws: "", repo: "", bs: "", bc: "", applet: "", application: ""};
	let answer;
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
	
	const HTMLPage = getWSRepo.HTMLPage(workspaces, repositories);

	const provider = { 
        resolveWebviewView: (thisWebview) => {
            thisWebview.webview.options = {enableScripts: true};
			thisWebview.webview.onDidReceiveMessage(async (message) => {
				selected.ws = wsrepo.ws[message.ws];
				selected.repo = wsrepo.repo[message.repo];
				busServObj = await getData.getSiebelData(wsrepo.ws[message.ws], wsrepo.repo[message.repo], "S_SERVICE");
				const treeDataBS = new TreeData.TreeDataProvider(busServObj);
				const treeViewBS = vscode.window.createTreeView('businessServices', {
					treeDataProvider: treeDataBS
				  });
				  treeViewBS.onDidChangeSelection(async (e) => {
					selected.bs = busServObj[e.selection[0].label];
					//vscode.window.showInformationMessage(`Selected Workspace: ${message.ws} Id: ${wsrepo.ws[message.ws]} and Repository: ${message.repo} Id: ${wsrepo.repo[message.repo]} Business Service Name: ${e.selection[0].label} Id: ${selected.bs}`);
					answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} business service from the Siebel database?`, ...["Yes", "No"]);
					if (answer === "Yes"){
						treeDataBS.refresh();
					}
				});
				busCompObj = await getData.getSiebelData(wsrepo.ws[message.ws], wsrepo.repo[message.repo], "S_BUSCOMP");
				const treeDataBC = new TreeData.TreeDataProvider(busCompObj);
				const treeViewBC = vscode.window.createTreeView('businessComponents', {
					treeDataProvider: treeDataBC
				  });
				  treeViewBC.onDidChangeSelection(async (e) => {
					selected.bc = busCompObj[e.selection[0].label];
					//vscode.window.showInformationMessage(`Selected Workspace: ${message.ws} Id: ${wsrepo.ws[message.ws]} and Repository: ${message.repo} Id: ${wsrepo.repo[message.repo]} Business Component Name: ${e.selection[0].label} Id: ${selected.bc}`);
					answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} business component from the Siebel database?`, ...["Yes", "No"]);
					if (answer === "Yes"){
						treeDataBC.refresh();
					}
				});
				appletObj = await getData.getSiebelData(wsrepo.ws[message.ws], wsrepo.repo[message.repo], "S_APPLET");
				const treeDataApplet = new TreeData.TreeDataProvider(appletObj);
				const treeViewApplet = vscode.window.createTreeView('applets', {
					treeDataProvider: treeDataApplet
				  });
				  treeViewApplet.onDidChangeSelection(async (e) => {
					selected.applet = appletObj[e.selection[0].label];
					//vscode.window.showInformationMessage(`Selected Workspace: ${message.ws} Id: ${wsrepo.ws[message.ws]} and Repository: ${message.repo} Id: ${wsrepo.repo[message.repo]} Applet Name: ${e.selection[0].label} Id: ${selected.applet}`);
					answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} from the Siebel database?`, ...["Yes", "No"]);
					if (answer === "Yes"){
						treeDataApplet.refresh();
					}
				});
				applicationObj = await getData.getSiebelData(wsrepo.ws[message.ws], wsrepo.repo[message.repo], "S_APPLICATION");
				const treeDataApplication = new TreeData.TreeDataProvider(applicationObj);
				const treeViewApplication = vscode.window.createTreeView('applications', {
					treeDataProvider: treeDataApplication
				  });
				  treeViewApplication.onDidChangeSelection(async (e) => {
					selected.application = applicationObj[e.selection[0].label];
					//vscode.window.showInformationMessage(`Selected Workspace: ${message.ws} Id: ${wsrepo.ws[message.ws]} and Repository: ${message.repo} Id: ${wsrepo.repo[message.repo]} Applet Name: ${e.selection[0].label} Id: ${selected.application}`);
					answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} application from the Siebel database?`, ...["Yes", "No"]);
					if (answer === "Yes"){
						treeDataApplication.refresh();
					}
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
