const vscode = require("vscode");
const getHTML = require("./src/getHTML.js");
const dataService = require("./src/dataService.js");
const treeData = require("./src/treeData.js");
const { default: axios } = require("axios");

async function activate(context) {
	const isWSFolderOpen = vscode.workspace.workspaceFolders?.[0];
	if (!isWSFolderOpen) {
		vscode.window.showErrorMessage("Please open a Visual Studio Code workspace folder to use the extension!");
		return;
	}
	let isConfigError = false;
	let answer;
	let provider;
	let extensionView;
	let pullButton, pushButton;
	let interceptor;
	let url, username, password;
	let searchString;
	let treeDataBS, treeDataBC, treeDataApplet, treeDataApplication, treeDataWebTemp;
	const NO_REST_CONFIG = true;
	const RELOAD_ENABLED = true;
	const IS_WEBTEMPLATE = true;
	const reqParams = { "PageSize": 20, "fields": "Name", "ChildLinks": "None", "uniformresponse": "y" };
	const connectionConfigs = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["REST EndpointConfigurations"];
	const isWorkspaceREST = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["getWorkspacesFromREST"];
	const workspaces = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["workspaces"];
	const clearTreeViews = () => {
		for (let treeDataObj of [treeDataBS, treeDataBC, treeDataApplet, treeDataApplication, treeDataWebTemp]) {
			treeDataObj?.refresh?.({});
		}
	}

	if (connectionConfigs.length === 0 || (workspaces.length === 0 && !isWorkspaceREST)) {
		vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
		pullButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pullScript", async () => {
			vscode.window.showErrorMessage("Error parsing the connection parameters, please check format of the REST Endpoint Configurations and the Workspaces settings, then reload the extension!");
			vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
		})
		context.subscriptions.push(pullButton);

		pushButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pushScript", async () => {
			vscode.window.showErrorMessage("Error parsing the connection parameters, please check format of the REST Endpoint Configurations and the Workspaces settings, then reload the extension!");
			vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
		})
		context.subscriptions.push(pushButton);

		//create the webview for the first setup
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.html = getHTML.HTMLPage({}, {}, NO_REST_CONFIG);
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {
						case "testREST": {
							const readConfigTestArr = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["REST EndpointConfigurations"];
							const readWorkspaceTestArr = vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")["workspaces"];
							if (readConfigTestArr.length > 0 && readWorkspaceTestArr.length > 0) {
								const [readConfigTest, baseUrl] = readConfigTestArr[0].split("@");
								const [connConf, username, password] = readConfigTest.split("/");
								const [connWS, workspaceTestArr] = readWorkspaceTestArr[0].split(":");
								const workspaceTest = workspaceTestArr && workspaceTestArr.split(",")[0];
								const url = `${baseUrl}/workspace/${workspaceTest}/Application`;
								if (connConf !== connWS || !(baseUrl && username && password && workspaceTest)) {
									vscode.window.showErrorMessage("Check the format of the REST Endpoint Configurations and the Workspaces settings!");
								} else {
									const testResp = await dataService.callRESTAPIInstance({ url, username, password }, "get", reqParams);
									if (testResp.length > 0) {
										vscode.window.showInformationMessage("Connection is working!");
										thisWebview.webview.html = getHTML.HTMLPage({}, {}, NO_REST_CONFIG, RELOAD_ENABLED);
									} else {
										vscode.window.showErrorMessage("Connection error, please check connection parameters and Siebel server status!");
									}
								}
							} else {
								vscode.window.showErrorMessage("Please add at least one REST Endpoint configuration and workspace for that configuration!");
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
		const workspaceObject = {};
		const configData = {};
		try {
			//get workspaces object from the Workspaces setting
			if (!isWorkspaceREST) {
				for (let workspace of workspaces) {
					let [connectionName, workspaceString] = workspace.split(":");
					if (!workspaceString) {
						vscode.window.showErrorMessage(`No workspace was found for the ${connectionName} connection, check the Workspaces setting!`);
						throw err;
					}
					workspaceObject[connectionName] = [...workspaceString.split(",")];
				}
			}
			//get the connections object
			for (let config of connectionConfigs) {
				let [connUserPwString, url] = config.split("@");
				let [connectionName, username, password] = connUserPwString.split("/");
				if (!(url && username && password)) {
					vscode.window.showErrorMessage(`Missing parameter(s) for the ${connectionName} connection, check the REST Endpoint Configurations setting!`);
					throw err;
				}
				if (!workspaceObject.hasOwnProperty(connectionName) && !isWorkspaceREST) {
					vscode.window.showErrorMessage(`No workspace was found for the ${connectionName} connection, check the settings!`);
					throw err;
				}
				let connectionObj = { username, password, url, workspaces: workspaceObject[connectionName] };
				configData[connectionName] = connectionObj;
			}
			//get workspaces from Siebel through REST
			if (isWorkspaceREST) {
				for (let [connectionName, connParams] of Object.entries(configData)) {
					const workspaces = await dataService.getWorkspaces(connParams);
					configData[connectionName].workspaces = workspaces;
					if (workspaces.length === 0){
						delete configData[connectionName]
					}
				}
				if (Object.keys(configData).length === 0) {
					vscode.window.showErrorMessage(`No workspace with status Checkpointed or Edith-In-Progress was found for any connection with the given username or the Base Workspace integration object is missing or was not merged into the primary branch in Siebel!`);
					throw err;
				}
			}
		} catch (err) {
			vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
			isConfigError = true;
		}
		const firstConnection = Object.keys(configData).includes(defConnName) ? defConnName : Object.keys(configData)[0];
		const firstWorkspace = configData[firstConnection]?.workspaces?.includes?.(defWS) ? defWS :  configData[firstConnection]?.workspaces?.[0];
		const selected = { connection: firstConnection, workspace: firstWorkspace, object: "Business Service", service: { name: "", childName: "" }, buscomp: { name: "", childName: "" }, applet: { name: "", childName: "" }, application: { name: "", childName: "" }, webtemp: { name: "" } };
		const folderPath = () => `${selected.connection}/${selected.workspace}`;
		let busServObj = {};
		let busCompObj = {};
		let appletObj = {};
		let applicationObj = {};
		let webTempObj = {};

		//check if there is error in the format of the settings
		if (!isConfigError && selected.connection) {
			//button to get the focused script from database
			pullButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pullScript", async () => {
				answer = await vscode.window.showInformationMessage("Do you want to overwrite the current script/web template definition from Siebel?", "Yes", "No");
				if (answer === "Yes") {
					dataService.pushOrPullScript("pull", configData);
				}
			})
			context.subscriptions.push(pullButton);

			//button to update the focused script in the database
			pushButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pushScript", async () => {
				answer = await vscode.window.showInformationMessage("Do you want to overwrite this script/web template definition in Siebel?", "Yes", "No");
				if (answer === "Yes") {
					dataService.pushOrPullScript("push", configData);
				}
			})
			context.subscriptions.push(pushButton);

			//create the interceptor for the default/first connection
			({ url, username, password } = configData[selected.connection]);
			interceptor = axios.interceptors.request.use((config) => ({ ...config, baseURL: `${url}/workspace/${selected.workspace}`, auth: { username, password } }));
		} else {
			pullButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pullScript", async () => {
				vscode.window.showErrorMessage("Error parsing the connection parameters, please check format of the REST Endpoint Configurations and the Workspaces settings, then reload the extension!");
				vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
			})
			context.subscriptions.push(pullButton);

			pushButton = vscode.commands.registerCommand("siebelscriptandwebtempeditor.pushScript", async () => {
				vscode.window.showErrorMessage("Error parsing the connection parameters, please check format of the REST Endpoint Configurations and the Workspaces settings, then reload the extension!");
				vscode.commands.executeCommand("workbench.action.openSettings", "siebelScriptAndWebTempEditor");
			})
			context.subscriptions.push(pushButton);
		}

		//handle the datasource selection
		provider = {
			resolveWebviewView: (thisWebview) => {
				thisWebview.webview.options = { enableScripts: true };
				thisWebview.webview.onDidReceiveMessage(async (message) => {
					switch (message.command) {
						case "selectConnection": {
							//handle connection selection, create the new interceptor and clear the tree views
							selected.connection = message.connectionName;
							selected.workspace = defConnName === selected.connection ? defWS : configData[selected.connection]?.workspaces?.[0],
								({ url, username, password } = configData[selected.connection]);
							axios.interceptors.request.eject(interceptor);
							interceptor = axios.interceptors.request.use((config) => ({ ...config, baseURL: `${url}/workspace/${selected.workspace}`, auth: { username, password } }));
							vscode.window.showInformationMessage(`Selected connection: ${selected.connection}`);
							thisWebview.webview.html = getHTML.HTMLPage(configData, selected);
							clearTreeViews();
							break;
						}
						case "selectWorkspace": {
							//handle workspace selection, create the new interceptor and clear the tree views
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
									treeDataWebTemp = new treeData.TreeDataProvider(webTempObj, IS_WEBTEMPLATE);
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
