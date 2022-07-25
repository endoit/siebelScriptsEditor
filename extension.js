const vscode = require("vscode");
const getHTML = require("./src/getHTML.js");
const dataService = require("./src/dataService.js");
const treeData = require("./src/treeData.js");
const { default: axios } = require("axios");

async function activate(context) {
	let answer;
	let provider;
	let extensionView;
	let interceptor;
	let url, username, password;
	let searchString;
	let treeDataBS, treeDataBC, treeDataApplet, treeDataApplication, treeDataWebTemp;
	const reqParams = { "PageSize": 20, "fields": "Name", "ChildLinks": "None", "uniformresponse": "y" }
	const connectionConfigs = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["REST EndpointConfigurations"];
	const workspaces = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["workspaces"];
	const clearTreeViews = () => {
		for (let treeDataObj of [treeDataBS, treeDataBC, treeDataApplet, treeDataApplication, treeDataWebTemp]){
			treeDataObj?.refresh({});
		}
	}

	if (connectionConfigs.length === 0 || workspaces.length === 0) {
		answer = await vscode.window.showInformationMessage("No REST Endpoint configuration/workspace was found in the settings, do you want to go open the settings?", "Yes", "No");
		if (answer === "Yes") {
			//opens the Settings for the extension
			vscode.commands.executeCommand("workbench.action.openSettings", "SiebelScriptAndWebTempEditor");
		}
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.html = getHTML.HTMLPage({}, {}, true);
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {					
						case "testREST": {
							const readConfigTestArr = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["REST EndpointConfigurations"];
							const readWorkspaceTestArr = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["workspaces"];
							if (readConfigTestArr.length > 0) {
								const [readConfigTest, baseUrl] = readConfigTestArr[0].split("@");
								const [, username, password] = readConfigTest.split("/");		
								const workspaceTestArr = readWorkspaceTestArr[0].split(":");
								const [workspaceTest] = workspaceTestArr[1].split(",");
								const url = `${baseUrl}/workspace/${workspaceTest}/Application`;
								const testResp = await dataService.callRESTAPIInstance({ url , username, password }, "get", reqParams);
								if (testResp.length > 0) {
									vscode.window.showInformationMessage("Connection is working!");
									thisWebview.webview.html = getHTML.HTMLPage({}, {}, true, true);
								} else {
									vscode.window.showInformationMessage("Connection error, please check connection parameters and Siebel server status!");
								}
							} else {
								vscode.window.showInformationMessage("Please add at least one REST Endpoint configuration and workspace for that configuration!");
							}
							break;
						}
						case "openConfig": {
							//opens the Settings for the extension
							vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
							break;
						}
						case "reload": {
							//reloads the extension
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
		const defConnNameWSString = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor").defaultConnection;
		let [defConnName, defWS] = defConnNameWSString && defConnNameWSString.split(":");
		const workspaceObject = {}
		for (let workspace of workspaces) {
			let [connectionName, workspaceString] = workspace.split(":");
			workspaceObject[connectionName] = [...workspaceString.split(",")];
		}
		const configData = {};
		for (let config of connectionConfigs) {
			let [connUserPwString, url] = config.split("@");
			let [connectionName, username, password] = connUserPwString.split("/");
			let connectionObj = { username, password, url, workspaces: workspaceObject[connectionName] };
			configData[connectionName] = connectionObj;
		}
		const firstConnection = Object.keys(configData)[0];
		const selected = { connection: defConnName || firstConnection, workspace: defWS || configData[firstConnection].workspaces[0], object: "Business Service", service: { name: "", childName: "" }, buscomp: { name: "", childName: "" }, applet: { name: "", childName: "" }, application: { name: "", childName: "" }, webtemp: {name: ""} };
		const folderPath = () => `${selected.connection}/${selected.workspace}`;
		let busServObj = {};
		let busCompObj = {};
		let appletObj = {};
		let applicationObj = {};
		let webTempObj = {};

		//button to get the focused script from database
		let pullButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pullScript", async () => {
			answer = await vscode.window.showInformationMessage("Do you want to overwrite the current script/web template definition from Siebel?", "Yes", "No");
			if (answer === "Yes") {
				dataService.pushOrPullScript("pull", configData);
			}
		})
		context.subscriptions.push(pullButton);

		//button to update the focused script in the database
		let pushButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pushScript", async () => {
			answer = await vscode.window.showInformationMessage("Do you want to overwrite this script/web template definition in Siebel?", "Yes", "No");
			if (answer === "Yes") {
				dataService.pushOrPullScript("push", configData);
			}
		})
		context.subscriptions.push(pushButton);

		//create the interceptor for the default/first connection
		({ url, username, password } = configData[selected.connection]);
		interceptor = axios.interceptors.request.use((config) => ({ ...config, baseURL: `${url}/workspace/${selected.workspace}`, auth: { username, password } }));

		//handle the datasource selection
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {
						case "selectConnection": {
							//handle connection selection and create new interceptor
							selected.connection = message.connectionName;
							selected.workspace = defConnName === selected.connection ? defWS : configData[selected.connection].workspaces[0],
							({ url, username, password } = configData[selected.connection]);
							axios.interceptors.request.eject(interceptor);
							interceptor = axios.interceptors.request.use((config) => ({ ...config, baseURL: `${url}/workspace/${selected.workspace}`, auth: { username, password } }));
							vscode.window.showInformationMessage(`Selected connection: ${selected.connection}`);
							thisWebview.webview.html = getHTML.HTMLPage(configData, selected);
							clearTreeViews();
							break;
						}
						case "selectWorkspace": {
							//handle workspace selection and create new interceptor
							selected.workspace = message.workspace;
							({ url, username, password } = configData[selected.connection]);
							axios.interceptors.request.eject(interceptor);
							interceptor = axios.interceptors.request.use((config) => ({ ...config, baseURL: `${url}/workspace/${selected.workspace}`, auth: { username, password } }));
							vscode.window.showInformationMessage(`Selected workspace: ${message.workspace}`);
							thisWebview.webview.html = getHTML.HTMLPage(configData, selected);
							clearTreeViews();
							break;
						}
						case "selectObject": {
							//handle Siebel object selection
							selected.object = message.object;
							thisWebview.webview.html = getHTML.HTMLPage(configData, selected);
							break;
						}
						case "search": {
							//get the Siebel objects and create the tree views
							({ searchString } = message);
							switch (selected.object) {
								case "Business Service": {
									busServObj = await dataService.getSiebelData({ ...reqParams, "searchspec": `Name LIKE "${searchString}*"` }, folderPath(), "service");
									treeDataBS = new treeData.TreeDataProvider(busServObj);
									const treeViewBS = vscode.window.createTreeView("businessServices", { treeDataProvider: treeDataBS });
									treeViewBS.onDidChangeSelection(async (e) => treeData.selectionChange(e, "service", selected, busServObj, treeDataBS));
									break;
								}
								case "Business Component": {
									busCompObj = await dataService.getSiebelData({ ...reqParams, "searchspec": `Name LIKE "${searchString}*"` }, folderPath(), "buscomp");
									treeDataBC = new treeData.TreeDataProvider(busCompObj);
									const treeViewBC = vscode.window.createTreeView("businessComponents", { treeDataProvider: treeDataBC });
									treeViewBC.onDidChangeSelection(async (e) => treeData.selectionChange(e, "buscomp", selected, busCompObj, treeDataBC));
									break;
								}
								case "Applet": {
									appletObj = await dataService.getSiebelData({ ...reqParams, "searchspec": `Name LIKE "${searchString}*"` }, folderPath(), "applet");
									treeDataApplet = new treeData.TreeDataProvider(appletObj);
									const treeViewApplet = vscode.window.createTreeView("applets", { treeDataProvider: treeDataApplet });
									treeViewApplet.onDidChangeSelection(async (e) => treeData.selectionChange(e, "applet", selected, appletObj, treeDataApplet));
									break;
								}
								case "Application": {
									applicationObj = await dataService.getSiebelData({ ...reqParams, "searchspec": `Name LIKE "${searchString}*"` }, folderPath(), "application");
									treeDataApplication = new treeData.TreeDataProvider(applicationObj);
									const treeViewApplication = vscode.window.createTreeView("applications", { treeDataProvider: treeDataApplication });
									treeViewApplication.onDidChangeSelection(async (e) => treeData.selectionChange(e, "application", selected, applicationObj, treeDataApplication));
									break;
								}
								case "Web Template": {
									webTempObj = await dataService.getSiebelData({ ...reqParams, "searchspec": `Name LIKE "${searchString}*"` }, folderPath(), "webtemp");
									treeDataWebTemp = new treeData.TreeDataProvider(webTempObj, true);
									const treeViewWebTemp = vscode.window.createTreeView("webTemplates", { treeDataProvider: treeDataWebTemp });
									treeViewWebTemp.onDidChangeSelection(async (e) => treeData.selectionChange(e, "webtemp", selected, webTempObj, treeDataWebTemp));
									break;
								}
							}
							break;
						}
						case "setDefault": {
							//sets the default connection and workspace in the settings
							answer = await vscode.window.showInformationMessage(`Do you want to set the default connection to ${message.connectionName} and the default workspace to ${message.workspace}?`, "Yes", "No");
							if (answer === "Yes") {
								await vscode.workspace.getConfiguration().update("siebelScriptAndWebTempEditor.defaultConnection", `${message.connectionName}:${message.workspace}`, vscode.ConfigurationTarget.Global);
							}
							break;
						}
						case "openConfig": {
							//opens the Settings for the extension
							vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
							break;
						}
						case "reload": {
							//reloads the extension
							vscode.commands.executeCommand("workbench.action.reloadWindow");
							break;
						}
					}
				}, undefined, context.subscriptions);
				thisWebview.webview.html = getHTML.HTMLPage(configData, selected);
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
