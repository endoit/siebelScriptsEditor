const vscode = require('vscode');
const filesRW = require('./src/filesRW.js');
const getData = require('./src/getData.js');
const treeData = require('./src/treeData.js');
const getHTML = require('./src/getHTML.js');
const fs = require('fs')

async function activate(context) {
	let answer;
	let provider;
	const configFilePath = vscode.Uri.file(`${vscode.workspace.workspaceFolders[0].uri.fsPath}/config.json`);
	if (fs.existsSync(configFilePath.fsPath) === false){
		answer = await vscode.window.showInformationMessage("config.json was not found in the current workspace, do you want to create it to initialize the extension?", ...["Yes", "No"]);
		if (answer === "Yes"){
			const newConfigData = {
				"default": {
					"db": "",
					"repo": "",
					"ws": ""
				},
				"DBConnection": {
					"DATABASE_NAME": {
						"user": "DATABASE_USERNAME",
						"password": "DATABASE_PASSWORD",
						"connectString": "111.111.111.111:1111/SIEBEL"
					}
				}
			}
			const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(configFilePath, { overwrite: false, ignoreIfExists: true });
      await vscode.workspace.applyEdit(wsEdit);
			vscode.workspace.fs.writeFile(configFilePath, Buffer.from(JSON.stringify(newConfigData, null, 2), 'utf8'));
			vscode.window.showTextDocument(configFilePath, { "preview": false });
		}
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.html = getHTML.HTMLPage();
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {
						case "testdb": {
							const readConfigTest = await vscode.workspace.fs.readFile(configFilePath);
							const configDataTest = JSON.parse(Buffer.from(readConfigTest)).DBConnection;
							const testDB = Object.entries(configDataTest)[0][1];
							const testResp = await getData.getRepoData(testDB);
							if (Object.keys(testResp).length > 0){
								vscode.window.showInformationMessage("Database connection is working!");
								thisWebview.webview.html = getHTML.HTMLPage("enablereload");
							} else {
								vscode.window.showInformationMessage("Connection error, please check credentials and database status!");
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
		};
		let extensionView = vscode.window.registerWebviewViewProvider("extensionView", provider);
		context.subscriptions.push(extensionView);
	} else {
		const readConfig = await vscode.workspace.fs.readFile(configFilePath);
		const configData = JSON.parse(Buffer.from(readConfig));
		const configObj = configData.DBConnection;
		const defaultObj = configData.default
		const firstDB = Object.keys(configData.DBConnection)[0];
		const selected = { date: "", scr: "", db: defaultObj.db || firstDB, ws: "", repo: "", service: { id: "", name: "", childId: "" }, buscomp: { id: "", name: "", childId: "" }, applet: { id: "", name: "", childId: "" }, application: { id: "", name: "", childId: "" } };
		const folders = { db: selected.db, repo: "", ws: "" };
		const folderPath = () => `${folders.db}_${folders.repo}/${folders.ws}`;
		const dbRepoWS = { db: "", repo: "", ws: "" }
		dbRepoWS.db = configObj;
		dbRepoWS.repo = await getData.getRepoData(configObj[selected.db]);
		console.log(dbRepoWS.repo)
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
							//sets the default database, repository and workspace in the config.json
							answer = await vscode.window.showInformationMessage(`Do you want to set the default database to ${message.db}, the default repository to ${message.repo} and the default workspace to ${message.ws}?`, ...["Yes", "No"]);
							if (answer === "Yes"){
								configData.default = { "db":  message.db, "repo": message.repo, "ws": message.ws };
								vscode.workspace.fs.writeFile(configFilePath, Buffer.from(JSON.stringify(configData, null, 2), 'utf8'));
							}
						}
						case "openConfig": {
							//opens the config.json file
							vscode.window.showTextDocument(configFilePath, { "preview": false });
						}
					}
				}, undefined, context.subscriptions);
				thisWebview.webview.html = getHTML.HTMLPage(dbRepoWS, defaultObj.db || firstDB, defaultObj.repo || firstRepo, defaultObj.ws || firstWS);
			}
		};
		let extensionView = vscode.window.registerWebviewViewProvider("extensionView", provider);
		context.subscriptions.push(extensionView);
	}
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
