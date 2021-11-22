const vscode = require('vscode');
const filesRW = require('./src/filesRW.js');
const getData = require('./src/getData.js');
const treeData = require('./src/treeData.js');
const getHTML = require('./src/getHTML.js');

async function activate(context) {
	let answer;
	let config;
	let provider;
	let dbParams;
	let dbNameUserPw;
	let extensionView;
	let dbConfigs = vscode.workspace.getConfiguration('siebelScriptEditor').databaseConfigurations;
	if (dbConfigs.length === 0){
		answer = await vscode.window.showInformationMessage("No database configuration was found in the settings, do you want to go to settings and create one?", ...["Yes", "No"]);
		if (answer === "Yes"){
			//opens the Settings for the extension file
			vscode.commands.executeCommand("workbench.action.openSettings", "SiebelScriptEditor");
		}
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.html = getHTML.HTMLPage();
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {
						case "testdb": {
							const readConfigTestArr = vscode.workspace.getConfiguration('siebelScriptEditor').databaseConfigurations;
							if (readConfigTestArr.length > 0){
								const readConfigTest = readConfigTestArr[0].split("@");
								const userPasswordTest = readConfigTest[0].split("/");
								const configDataTest = {user: userPasswordTest[1], password: userPasswordTest[2], connectString: readConfigTest[1]};
								const testResp = await getData.getRepoData(configDataTest);
								if (Object.keys(testResp).length > 0){
									vscode.window.showInformationMessage("Database connection is working!");
									thisWebview.webview.html = getHTML.HTMLPage("enablereload");
								} else {
									vscode.window.showInformationMessage("Connection error, please check credentials and database status!");
								}
							} else {
								vscode.window.showInformationMessage("Please add at least one database configuration!");
							}
							break;
						}
						case "reload": {
							vscode.commands.executeCommand("workbench.action.reloadWindow");				
							break;
						}
					}
				})
			}
		}
		extensionView = vscode.window.registerWebviewViewProvider("extensionView", provider);
		context.subscriptions.push(extensionView);
	} else {
		let defConnection = vscode.workspace.getConfiguration('siebelScriptEditor').defaultConnection.split("/");
		let configData = {default: {}, DBConnection: {}};
		for (config of dbConfigs){
			dbParams = config.split("@");
			dbNameUserPw = dbParams[0].split("/");
			configData.DBConnection[dbNameUserPw[0]] = {user: dbNameUserPw[1], password: dbNameUserPw[2], connectString: dbParams[1]};
			if (dbNameUserPw[0] === defConnection[0]){
				configData.default = {db: defConnection[0], repo: defConnection[1], ws: defConnection[2]}
			}
		}
		const configObj = configData.DBConnection;
		const defaultObj = configData.default
		const firstDB = Object.keys(configData.DBConnection)[0];
		const selected = { date: "", scr: "", db: defaultObj.db || firstDB, ws: "", repo: "", service: { id: "", name: "", childId: "" }, buscomp: { id: "", name: "", childId: "" }, applet: { id: "", name: "", childId: "" }, application: { id: "", name: "", childId: "" } };
		const folders = { db: selected.db, repo: "", ws: "" };
		const folderPath = () => `${folders.db}_${folders.repo}/${folders.ws}`;
		const dbRepoWS = { db: "", repo: "", ws: "" }
		dbRepoWS.db = configObj;
		dbRepoWS.repo = await getData.getRepoData(configObj[selected.db]);
		let firstRepo = Object.keys(dbRepoWS.repo)[0];
		dbRepoWS.ws = await getData.getWSData(dbRepoWS.repo[defaultObj.repo || firstRepo], configObj[selected.db]);
		let firstWS = Object.keys(dbRepoWS.ws)[0];
		let busServObj = {};
		let busCompObj = {};
		let appletObj = {};
		let applicationObj = {};

		//button to get the focused script from database
		let pullButton = vscode.commands.registerCommand('siebelscripteditor.pullScript', async () => {
			answer = await vscode.window.showInformationMessage("Do you want to overwrite the current script from the Siebel database?", ...["Yes", "No"]);
			if (answer === "Yes") {
				getData.pushOrPullScript("pull", configObj);
			}
		})
		context.subscriptions.push(pullButton);

		//button to update the focused script in the database
		let pushButton = vscode.commands.registerCommand('siebelscripteditor.pushScript', async () => {
			answer = await vscode.window.showInformationMessage("Do you want to overwrite this script in the Siebel database?", ...["Yes", "No"]);
			if (answer === "Yes") {
				getData.pushOrPullScript("push", configObj);
			}
		})
		context.subscriptions.push(pushButton);

		//handle the datasource selection
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {
						case "selectDB": {
							//handle database selection
							folders.db = message.db;
							selected.db = message.db;
							vscode.window.showInformationMessage(`Selected database: ${selected.db}`);
							dbRepoWS.repo = await getData.getRepoData(configObj[selected.db]);
							dbRepoWS.ws = await getData.getWSData(dbRepoWS.repo[firstRepo], configObj[selected.db]);
							thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, firstRepo);
							break;
						}
						case "selectRepo": {
							//handle repository selection
							folders.repo = message.repo;
							selected.repo = dbRepoWS.repo[message.repo];
							vscode.window.showInformationMessage(`Selected repository: ${message.repo}`);
							dbRepoWS.ws = await getData.getWSData(selected.repo, configObj[selected.db]);
							thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, message.repo);
							break;
						}
						case "selectWS": {
							//get data from the workspace and create the tree views
							folders.repo = message.repo
							folders.ws = message.ws
							selected.date = message.date
							selected.scr = message.scr;
							selected.repo = dbRepoWS.repo[message.repo];
							selected.ws = dbRepoWS.ws[message.ws];
							let backup = true;
							thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, selected.db, message.repo, message.ws, backup);
							vscode.window.showInformationMessage(`Selected repository: ${message.ws}`);

							busServObj = await getData.getSiebelData(selected, configObj[selected.db], "service", folderPath());
							const treeDataBS = new treeData.TreeDataProvider(busServObj);
							const treeViewBS = vscode.window.createTreeView("businessServices", { treeDataProvider: treeDataBS });
							treeViewBS.onDidChangeSelection(async (e) => treeData.selectionChange(e, "service", selected, configObj[selected.db], busServObj, treeDataBS, folders));

							busCompObj = await getData.getSiebelData(selected, configObj[selected.db], "buscomp", folderPath());
							const treeDataBC = new treeData.TreeDataProvider(busCompObj);
							const treeViewBC = vscode.window.createTreeView("businessComponents", { treeDataProvider: treeDataBC });
							treeViewBC.onDidChangeSelection(async (e) => treeData.selectionChange(e, "buscomp", selected, configObj[selected.db], busCompObj, treeDataBC, folders));

							appletObj = await getData.getSiebelData(selected, configObj[selected.db], "applet", folderPath());
							const treeDataApplet = new treeData.TreeDataProvider(appletObj);
							const treeViewApplet = vscode.window.createTreeView("applets", { treeDataProvider: treeDataApplet });
							treeViewApplet.onDidChangeSelection(async (e) => treeData.selectionChange(e, "applet", selected, configObj[selected.db], appletObj, treeDataApplet, folders));

							applicationObj = await getData.getSiebelData(selected, configObj[selected.db], "application", folderPath());
							const treeDataApplication = new treeData.TreeDataProvider(applicationObj);
							const treeViewApplication = vscode.window.createTreeView("applications", { treeDataProvider: treeDataApplication });
							treeViewApplication.onDidChangeSelection(async (e) => treeData.selectionChange(e, "application", selected, configObj[selected.db], applicationObj, treeDataApplication, folders));
							break;
						}
						case "backup": {
							//creates backup from the selected datasource
							const typeArr = ["service", "buscomp", "applet", "application"];
							let objType;
							let timeStamp = new Date();
							let timeStampStr = `${timeStamp.getFullYear()}${timeStamp.getMonth() + 1}${timeStamp.getDate()}_${timeStamp.getHours()}h${timeStamp.getMinutes()}m`;
							folders.repo = message.repo
							folders.ws = `${message.ws}_backup_${timeStampStr}`;
							selected.date = message.date
							selected.scr = message.scr;
							selected.repo = dbRepoWS.repo[message.repo];
							selected.ws = dbRepoWS.ws[message.ws];
							answer = await vscode.window.showInformationMessage(`Do you want to backup the ${message.ws} workspace from the ${message.repo},  ${selected.db} database?`, ...["Yes", "No"]);
							if (answer === "Yes") {
								vscode.window.withProgress({
									location: vscode.ProgressLocation.Window,
									cancellable: false,
									title: "Creating backup"
								}, async () => {
									for (objType of typeArr) {
										await getData.createBackup(selected, configObj[selected.db], objType, folderPath());
									}
									await filesRW.writeInfo(selected, folders, folderPath(), "backup");
									vscode.window.showInformationMessage(`Backup created in folder ${folders.ws}`);
								}
								);
							}
							break;
						}
						case "setDefault": {
							//sets the default database, repository and workspace in the settings
							answer = await vscode.window.showInformationMessage(`Do you want to set the default database to ${message.db}, the default repository to ${message.repo} and the default workspace to ${message.ws}?`, ...["Yes", "No"]);
							if (answer === "Yes"){
								configData.default = { "db":  message.db, "repo": message.repo, "ws": message.ws };
								await vscode.workspace.getConfiguration().update("siebelScriptEditor.defaultConnection", `${message.db}/${message.repo}/${message.ws}`, vscode.ConfigurationTarget.Global);
								
							}
						}
						case "openConfig": {
							//opens the Settings for the extension
							vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptEditor");
						}
					}
				}, undefined, context.subscriptions);
				thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, defaultObj.db || firstDB, defaultObj.repo || firstRepo, defaultObj.ws || firstWS);
			}
		};
		extensionView = vscode.window.registerWebviewViewProvider("extensionView", provider);
		context.subscriptions.push(extensionView);
	}
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
