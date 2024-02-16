import {
  SERVICE,
  BUSCOMP,
  APPLET,
  APPLICATION,
  WEBTEMP,
  repositoryObjects,
  CONNECTION,
  WORKSPACE,
  OBJECT,
  CONNECTIONS,
} from "./constants";
import { GlobalState, getSetting } from "./utility";

const css = `
		<style>
			.divitem {
				margin: 0.2em;
				display: flex;
			}
			.text {
				text-align: center;
			}
			.input-field {
				flex: 1 1 auto;
			}
			label {
				margin: 0.1em;
			}
			.opt {
				background: rgba(83, 89, 93, 1);
				color: rgb(204, 204, 204);
			}
			#connection, #workspace, #object, #search-bar {
				border-radius: 0.4em;
				margin: 0.1em;
				text-align: center;
				background-color: rgba(83, 89, 93, 0.5);
				color: rgb(204, 204, 204);
				border: 0;
				padding: 0.2em;
				width: 10em;
			}
			.button-small {
				flex: 1 1 auto;
				margin: 0.2em;
				border: none;
				padding: 0.5em;
				width: 49%;
				height: 3em;
				text-align: center;
				outline: 1px solid transparent;
				outline-offset: 2px!important;
				color: var(--vscode-button-foreground);
				background: var(--vscode-button-background);
				text-align: center;
				border-radius: 0.4em;
				box-sizing: border-box;
			}
		</style>`;

//generates the HTML page for the webview to select the REST endpoint, workspace, resource and for the searchbar
export const webViewHTML = (globalState: GlobalState): string => {
  const configData = getSetting(CONNECTIONS),
    connection = globalState.get(CONNECTION),
    workspace = globalState.get(WORKSPACE),
    object = globalState.get(OBJECT);

  if (!connection)
    return `
		<!doctype><html>
			<head>
				${css}
			</head>
			<body>
				<div class="text">Error in parsing the settings, please give at least one valid REST Endpoint configuration, and at least one workspace for that REST configuration!</div>
				<div class="divitem">
				<Button class="button-small" id="connections" onclick="configureConnections()">Configure connections</Button>  
			</div>		
				<div class="divitem">
						<Button class="button-small" id="settings" onclick="openSettings()">Open settings</Button>
					</div>
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const configureConnections = () => {
						vscode.postMessage({command: "configureConnections"});
					}
					const openSettings = () => {
						vscode.postMessage({command: "openSettings"});
					}
				</script>
			</body>
		</html>`;

  const connections = Object.keys(configData)
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          connection === item ? "selected" : ""
        }>${item}</option>`
    )
    .join("");
  const workspaces = configData[connection].workspaces
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          workspace === item ? "selected" : ""
        }>${item}</option>`
    )
    .join("");
  const objects = (
    [SERVICE, BUSCOMP, APPLET, APPLICATION, WEBTEMP] as SiebelObject[]
  )
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          object === item ? "selected" : ""
        }>${repositoryObjects[item].parent}
				</option>`
    )
    .join("");

  return `
		<!doctype><html>
			<head>
				${css}
			</head>
			<body>
				<div class="container">
					<div class="divitem">
						<label for="connection">Connection</label>
						<select name="connection" class="input-field" id="connection" onchange="selectConnection()">
							${connections}
						</select>
					</div>
					<div class="divitem">
						<label for="workspace">Workspace</label>
					  <select name="workspace" class="input-field" id="workspace" onchange="selectWorkspace()" >
							${workspaces}
						</select>
					</div>
					<div class="divitem">
						<label for="object">Object type</label> 
						<select name="object" class="input-field" id="object" onchange="selectObject()">                       
							${objects}
						</select>
					</div>
					<div class="divitem">
						<input type="search" name="search-bar" class="input-field" id="search-bar" oninput="handleSearch()" placeholder="Type here to search">
					</div>
					<div class="divitem">
					<Button class="button-small" id="connections" onclick="configureConnections()">Configure connections</Button>  
				</div>	
					<div class="divitem">
						<Button class="button-small" id="settings" onclick="openSettings()">Open settings</Button>  
					</div>
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const selectConnection = () => {
						const connectionName = document.getElementById("connection").value;
						vscode.postMessage({command: "connection", connectionName});
					}
					const selectWorkspace= () => {
						const workspace = document.getElementById("workspace").value;
						vscode.postMessage({command: "workspace", workspace});
					}
					const selectObject = () => {
						const object = document.getElementById("object").value;
						vscode.postMessage({command: "object", object});
					}
					const handleSearch = () => {					
						const searchString = document.getElementById("search-bar").value;
						if (searchString !== "") vscode.postMessage({command: "search", searchString});
					}
					const openSettings = () => {
						vscode.postMessage({command: "openSettings"});
					}
					const configureConnections = () => {
						vscode.postMessage({command: "configureConnections"});
					}
				</script>
			</body>
		</html>`;
};

export const configureConnectionsWebview = (connectionName: string) => {
  const {
    url,
    username,
    password,
    workspaces,
    restWorkspaces,
    defaultWorkspace,
  } = getSetting(CONNECTIONS)[connectionName];
  const workspaceList = workspaces
    .map((item) => `<option class="opt" value="${item}">${item}</option>`)
    .join("");

  return `<!doctype><html>
	<head>
		${css}
	</head>
	<body>
		<div class="container">
			<div class="divitem">
				<label for="connection-name">Connection Name</label>
				<input type="text" name="connection-name" class="input-field" id="connection-name" value=${connectionName}>
			</div>
			<div class="divitem">
				<label for="url">Siebel REST API endpoint</label>
				<input type="text" name="url" class="input-field" id="url" value=${url}>
			</div>
			<div class="divitem">
			<label for="username">Username</label> 
			<input type="text" name="username" class="input-field" id="username" value=${username}>
			</div>
			<div class="divitem">
			<label for="password">Password</label> 
			<input type="password" name="username" class="input-field" id="password" value=${password}>
			</div>
			<div class="divitem">
			<label for="workspaces">Workspaces</label> 
			<select>
${workspaceList}
			</select>
			</div>
			<div class="divitem">
			<label for="rest-workspaces">Get workspaces from the Siebel REST API</label> 
			<input type="checkbox" name="rest-workspaces" class="input-field" id="rest-workspaces" ${restWorkspaces ? "checked" : ""}>
			</div>
			<div class="divitem">
			<label for="username">Default workspace</label> 
			<input type="text" name="default-workspace" class="input-field" id="default-workspace" value=${defaultWorkspace}>
			</div>
			<div class="divitem">
				<Button class="button-small" id="test" onclick="testConnection()">Test connection</Button>  
			</div>
			<div class="divitem">
			<Button class="button-small" id="create" onclick="createOrUpdateConnection()">Save connection</Button>  
		</div>	
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const testConnection = () => {
				const url = document.getElementById("url").value,
				username = document.getElementById("username").value,
				password = document.getElementById("password").value;
				vscode.postMessage({command: "testConnection", url, username, password});
			}
			const createOrUpdateConnection = () => {
				const connectionName = document.getElementById("connection-name").value,
				 url = document.getElementById("url").value,
				username = document.getElementById("username").value,
				password = document.getElementById("password").value,
				restWorkspaces = document.getElementById("rest-workspaces").value,
				defaultWorkspace =  document.getElementById("default-workspace").value,
				workspaces = "test";
				vscode.postMessage({command: "createOrUpdateConnection", url, username, password, workspaces, restWorkspaces, defaultWorkspace});
			}
			</script>
		</body>
	</html>`;
};
