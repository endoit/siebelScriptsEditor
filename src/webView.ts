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
	DEFAULT_CONNECTION_NAME,
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
			.input-field[readonly] {
        background-color: #ced4da;
        color: #6c757d;
        cursor: not-allowed;
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
			.button-small:disabled {
        background-color: #ced4da;
        color: #6c757d;
        cursor: not-allowed;
    }
		
		</style>`;

//generates the HTML page for the webview to select the REST endpoint, workspace, resource and for the searchbar
export const webViewHTML = (globalState: GlobalState): string => {
  const configData = getSetting(CONNECTIONS),
    connection = globalState.get(CONNECTION),
    workspace = globalState.get(WORKSPACE),
    object = globalState.get(OBJECT);

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
						<input type="search" name="search-bar" class="input-field" id="search-bar" oninput="handleSearch()" placeholder="Type here to search"
						${connections.length === 0 ? "readonly" : ""}>
					</div>
					<div class="divitem">
					<Button class="button-small" id="new" onclick="newConnection()">New Connection</Button>  
				</div>
					<div class="divitem">
					<Button class="button-small" id="config" onclick="configureConnection()" ${
            connections.length === 0 ? "disabled" : ""
          }>Configure Connection</Button>  
				</div>	
					<div class="divitem">
						<Button class="button-small" id="settings" onclick="openSettings()">Open Settings</Button>  
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
					const newConnection = () => {
						vscode.postMessage({command: "newConnection"});
					}
					const configureConnection = () => {
						vscode.postMessage({command: "configureConnection"});
					}
					const openSettings = () => {
						vscode.postMessage({command: "openSettings"});
					}
				</script>
			</body>
		</html>`;
};

export const configureConnectionsWebview = (
  connectionName: string,
  isNewConnection = false
) => {
  const {
      url = "",
      username = "",
      password = "",
      workspaces = [],
      restWorkspaces = false,
      defaultWorkspace = "",
    } = isNewConnection ? {} : getSetting(CONNECTIONS)[connectionName],
		defaultConnectionName = getSetting(DEFAULT_CONNECTION_NAME),
    workspaceList = workspaces
      .map(
        (item) => `<li class="li" data-value="${item}">${item}
		<Button class="button-small" onclick="editWorkspaces()" name="default" ${
      item === defaultWorkspace ? "disabled" : ""
    }>${item === defaultWorkspace ? "Default" : "Set as default"}</Button>
		<Button class="button-small" name="delete" onclick="editWorkspaces()">Delete</Button>
		</li>`
      )
      .join("");

  return `<!doctype><html>
	<head>
		${css}
	</head>
	<body>
		<div class="container">
			<div class="divitem">
				<label for="connection-name">Connection Name</label>
				<input type="text" name="connection-name" class="input-field" id="connection-name" value=${
          isNewConnection ? "" : connectionName
        } ${isNewConnection ? "" : "readonly"}>
			</div>
			<div class="divitem">
				<label for="url">Siebel REST API Endpoint</label>
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
				<div>Workspaces <input type="text" name="add-workspace" class="input-field" id="add-workspace">
					<Button class="button-small" name="add" onclick="editWorkspaces()">Add</Button>			
				</div>
				<ul id="workspace-list">${workspaceList}</li>
			</div>
			<div class="divitem">
			<label for="rest-workspaces">Get workspaces from the Siebel REST API</label> 
			<input type="checkbox" name="rest-workspaces" class="input-field" id="rest-workspaces" ${
        restWorkspaces ? "checked" : ""
      }>
			</div>
			<div class="divitem">
			<label for="default-connection">Set as default connection</label> 
			<input type="checkbox" name="default-connection" class="input-field" id="default-connection" ${
        defaultConnectionName === connectionName ? "checked" : ""
      }>
			</div>
			<div class="divitem">
				<Button class="button-small" id="test" onclick="testConnection()">Test Connection</Button>  
			</div>
			<div class="divitem">
			<Button class="button-small" id="createOrUpdateConnection" onclick="createOrUpdateConnection()">Save Connection</Button>  
		</div>
		<div class="divitem">
		<Button class="button-small" id="deleteConnection" onclick="deleteConnection()" ${
      isNewConnection ? "disabled" : ""
    }>Delete Connection</Button>  
	</div>	
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const editWorkspaces = () => {
				const action = event.target.name,
					workspace = action === "add" ? document.getElementById("add-workspace").value : event.target.parentNode.dataset.value;
				if (!workspace) return;
				vscode.postMessage({command: "workspace", action, workspace});
			}
			const testConnection = () => {
				const url = document.getElementById("url").value,
				username = document.getElementById("username").value,
				password = document.getElementById("password").value;
				vscode.postMessage({command: "testConnection", url, username, password});
			}
			const createOrUpdateConnection = () => {
				const name = document.getElementById("connection-name").value,
					url = document.getElementById("url").value,
					username = document.getElementById("username").value,
					password = document.getElementById("password").value,
					restWorkspaces = document.getElementById("rest-workspaces").checked,
					defaultConnection = document.getElementById("default-connection").checked,
					defaultWorkspace = "", //document.getElementById("default-workspace").value,
					workspaces = [];
				
				vscode.postMessage({command: "createOrUpdateConnection", name, url, username, password, workspaces, restWorkspaces, defaultWorkspace, defaultConnection});
			}
			const deleteConnection = () => {
				const name = document.getElementById("connection-name").value;
				vscode.postMessage({command: "deleteConnection", name});
			}
			</script>
		</body>
	</html>`;
};
