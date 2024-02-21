import { config } from "process";
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
  REST_WORKSPACES,
} from "./constants";
import { GlobalState, getSetting } from "./utility";

const css = `
		<style>
			h1 {
				text-align:center;
			}

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
			.button-config-small:disabled {
        background-color: #ced4da;
        color: #6c757d;
        cursor: not-allowed;
    	}
			.button-config-small {
				margin: 0.2em;
				color: var(--vscode-button-foreground);
				background: var(--vscode-button-background);
				text-align: center;
				border-radius: 0.4em;
    	}

			.config {
				max-width: 550px;
				margin: 0 auto;
				display: grid;
				grid-template-columns: auto auto auto auto;
				gap: 10px;

			}
			.config-item {
				text-align: left;
				display: flex;
				flex-direction: column;
			}
			
			.grid-1 {
				grid-column: 1;
			}

			.grid-2 {
				grid-column: 2;
			}

			.grid-12 {
				grid-column: 1 / 2;
			}
			
			.grid-3 {
				grid-column: 3;
			}

			.grid-23 {
				grid-column: 2 / 3;
			}

			.grid-24 {
				grid-column: 2 / 4;
			}

			.grid-34 {
				grid-column: 3 / 4;
			}

			.grid-4 {
				grid-column: 4;
			}
			.checkbox {
				justify-self: end;
			}
			input[type="checkbox"] {
				width: 15px;
				height: 15px; 
			}
		</style>`;

//generates the HTML page for the webview to select the REST endpoint, workspace, resource and for the searchbar
export const webViewHTML = (globalState: GlobalState): string => {
  const configData = getSetting(CONNECTIONS),
    connection = globalState.get(CONNECTION),
    workspace = globalState.get(WORKSPACE),
    object = globalState.get(OBJECT),
    workspacesList = configData[connection].restWorkspaces
      ? globalState.get(REST_WORKSPACES)
      : configData[connection].workspaces;

  const connections = Object.keys(configData)
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          connection === item ? "selected" : ""
        }>${item}</option>`
    )
    .join("");
  const workspaces = workspacesList
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
        (item) => `<div class="config-item grid-1" data-value="${item}">
		<Button class="button-config-small" onclick="editWorkspaces()" name="default" ${
      item === defaultWorkspace ? "disabled" : ""
    }>${
          item === defaultWorkspace ? "Default" : "Set as default"
        }</Button></div><div class="config-item grid-2">${item}</div>
		<div class="config-item grid-3" data-value="${item}">
		<Button class="button-config-small" name="delete" onclick="editWorkspaces()">Delete</Button></div>`
      )
      .join("");

  return `<!doctype><html>
	<head>
		${css}
	</head>
	<body>
	<h1>${isNewConnection ? "Create New Connection" : "Edit Connection"}</h1>
		<div class="config">
			<div class="config-item grid-1">
				<label for="connection-name">Connection Name</label></div><div class="config-item grid-24">
				<input type="text" class="input-field" name="connection-name" id="connection-name" value=${
          isNewConnection ? "" : connectionName
        } ${isNewConnection ? "" : "readonly"}>
			</div>
			<div class="config-item grid-1">
				<label for="url">Siebel REST API Base URI</label></div><div class="config-item grid-24">
				<input type="text" name="url" id="url" value=${url}>
			</div>
			<div class="config-item grid-1">
			<label for="username">Username</label></div><div class="config-item grid-24"> 
			<input type="text" name="username" id="username" value=${username}>
			</div>
			<div class="config-item grid-1">
			<label for="password">Password</label></div><div class="config-item grid-24">
			<input type="password" name="username" id="password" value=${password}>
			</div>
			${
        isNewConnection
          ? ""
          : `<div class="config-item  grid-1"><label for="add-workspace">Workspaces</div>
					<div class="config-item  grid-2"><input type="text" name="add-workspace" id="add-workspace">
					</div><div class="config-item grid-34">
					<Button class="button-config-small" name="add" onclick="editWorkspaces()" id="add-workspace-button">Add</Button>			
				</div>
			${workspaceList}`
      }
			<div class="config-item grid-1 checkbox"> 
			<input type="checkbox" name="rest-workspaces" id="rest-workspaces" ${
        restWorkspaces ? "checked" : ""
      }>			
			</div>
			<div class="config-item grid-2"> 
			<label for="rest-workspaces">Get Workspaces From The Siebel REST API</label>
			</div>
			<div class="config-item grid-1 checkbox"> 
			<input type="checkbox" name="default-connection" id="default-connection" ${
        defaultConnectionName === connectionName ? "checked" : ""
      }>				</div>
			<div class="config-item grid-2"> 
			<label for="default-connection">Default Connection</label>
			</div>
			<div class="config-item grid-1">
				<Button class="button-config-small" id="test" onclick="testConnection()">Test Connection</Button>  
			</div>
			<div class="config-item grid-23">
			<Button class="button-config-small" id="createOrUpdateConnection" onclick="createOrUpdateConnection()">Save Connection</Button></div>  
			${
        isNewConnection
          ? ""
          : `<div class="config-item grid-3">
			<Button class="button-config-small" id="deleteConnection" onclick="deleteConnection()">Delete Connection</Button>
			</div>`
      }
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const addWorkspace = document.getElementById("add-workspace");
			if (addWorkspace){
				addWorkspace.addEventListener("keypress", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						document.getElementById("add-workspace-button").click();
					}
				});
			}
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
					defaultConnection = document.getElementById("default-connection").checked;
				vscode.postMessage({command: "createOrUpdateConnection", name, url, username, password, restWorkspaces, defaultConnection});
			}
			const deleteConnection = () => {
				const name = document.getElementById("connection-name").value;
				vscode.postMessage({command: "deleteConnection", name});
			}
			</script>
		</body>
	</html>`;
};
