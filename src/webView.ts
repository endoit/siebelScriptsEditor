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
import { GlobalState, getConnection, getSetting } from "./utility";

const css = `
		<style>

			h1 {
				text-align:center;
			}

			.config {
				max-width: 550px;
				margin: 0 auto;
				display: grid;
				grid-template-columns: auto auto auto auto;
				gap: 10px;
			}

			.datasource {
				margin: 10px auto 5px;
				display: grid;
				grid-template-columns: auto auto;
				gap: 6px;
			}
			
			.grid-item {
				text-align: left;
				display: flex;
				flex-direction: column;
			}

			#search-bar {
				text-align: center;
			}

			.input {
				background-color: var(--vscode-input-background);
				display: inline-block;
				box-sizing: border-box;
				width: 100%;
				height: 100%;
				line-height: inherit;
				border: none;
				font-family: inherit;
				font-size: inherit;
				color: inherit;
				border-radius: 2px;
			}

			.input[readonly] {
        background-color: var(--vscode-disabledForeground);
        cursor: not-allowed;
			}

			.checkbox {
				transform: scale(1.5);
				accent-color: var(--vscode-checkbox-background);
			}

			.checkbox-container {
				justify-self: end;
			}

			.select, .button, .checkbox {
				cursor: pointer;
			}

			.button {
				color: var(--vscode-button-foreground);
				background: var(--vscode-button-background);
				text-align: center;
				box-sizing: border-box;
				display: flex;
				width: 100%;
				padding: 4px;
				border-radius: 2px;
				text-align: center;
				justify-content: center;
				align-items: center;
				border: 1px solid var(--vscode-button-border,transparent);
				line-height: 18px;
    	}

			.button-small {
				line-height: 10px;
    	}

			.button:hover {
				background-color: var(--vscode-button-hoverBackground);
			}
			
			.button:disabled,
			.button[disabled]{
				background-color: var(--vscode-disabledForeground);
				cursor: not-allowed;
			}

			.grid-1 {
				grid-column: 1;
			}

			.grid-2 {
				grid-column: 2;
			}

			.grid-3 {
				grid-column: 3;
			}

			.grid-12 {
				grid-column: 1 / span 2;
			}
			
			.grid-23 {
				grid-column: 2 / span 1;
			}

			.grid-24 {
				grid-column: 2 / span 2;
			}

			.grid-34 {
				grid-column: 3 / span 1;
			}
		</style>`;

//creates the HTML page for the Select Datasource webview
export const dataSourceWebview = (globalState: GlobalState): string => {
  const connections = getSetting(CONNECTIONS),
    connectionName = globalState.get(CONNECTION),
    workspace = globalState.get(WORKSPACE),
    object = globalState.get(OBJECT),
    connection = getConnection(connectionName),
    workspaces = connection.restWorkspaces
      ? globalState.get(REST_WORKSPACES)
      : connection.workspaces,
    connectionsOptions = connections
      .map(
        ({ name }) =>
          `<option class="option" value="${name}" ${
            name === connectionName ? "selected" : ""
          }>${name}</option>`
      )
      .join(""),
    workspacesOptions = (workspaces ?? [])
      .map(
        (item) =>
          `<option class="option" value="${item}" ${
            workspace === item ? "selected" : ""
          }>${item}</option>`
      )
      .join(""),
    objectsOptions = (
      [SERVICE, BUSCOMP, APPLET, APPLICATION, WEBTEMP] as SiebelObject[]
    )
      .map(
        (item) =>
          `<option class="option" value="${item}" ${
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
				<div class="datasource">
					<div class="grid-item grid-1">
						<label for="connection">Connection</label>
					</div>
					<div class="grid-item grid-2">
						<select name="connection" class="input select" id="connection" onchange="selectConnection()">
							${connectionsOptions}
						</select>
					</div>
					<div class="grid-item grid-1">
						<label for="workspace">Workspace</label>
					</div>
					<div class="grid-item grid-2">
					  <select name="workspace" class="input select" id="workspace" onchange="selectWorkspace()" >
							${workspacesOptions}
						</select>
					</div>
					<div class="grid-item grid-1">
						<label for="object">Object type</label>
					</div>
					<div class="grid-item grid-2"> 
						<select name="object" class="input select" id="object" onchange="selectObject()">                       
							${objectsOptions}
						</select>
					</div>
					<div class="grid-item grid-12">
						<input type="search" name="search-bar" class="input" id="search-bar" oninput="handleSearch()" placeholder="Type here to search"
						${connections.length === 0 || workspaces.length === 0 ? "readonly" : ""}>
					</div>
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const selectConnection = () => {
						const name = document.getElementById("connection").value;
						vscode.postMessage({command: "connection", name});
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
				</script>
			</body>
		</html>`;
};

//creates the HTML page for the Create/Edit Connection webview
export const connectionWebview = (name: string, isNewConnection = false) => {
  const {
      url = "",
      username = "",
      password = "",
      workspaces = [],
      restWorkspaces = false,
      defaultWorkspace = "",
    } = isNewConnection ? {} : getConnection(name),
    defaultConnectionName = getSetting(DEFAULT_CONNECTION_NAME),
    workspaceList = workspaces
      .map(
        (item) => `<div class="grid-item grid-1" data-value="${item}">
		<Button class="button button-small" onclick="editWorkspaces()" name="default" ${
      item === defaultWorkspace ? "disabled" : ""
    }>${
          item === defaultWorkspace ? "Default" : "Set as default"
        }</Button></div><div class="grid-item grid-2">${item}</div>
		<div class="grid-item grid-3" data-value="${item}">
		<Button class="button button-small" name="delete" onclick="editWorkspaces()">Delete</Button></div>`
      )
      .join("");

  return `<!doctype><html>
	<head>
		${css}
	</head>
	<body>
		<h1>${isNewConnection ? "Create New Connection" : "Edit Connection"}</h1>
		<div class="config">
			<div class="grid-item grid-1">
				<label for="connection-name">Connection Name</label>
			</div>
			<div class="grid-item grid-24">
				<input type="text" class="input" name="connection-name" id="connection-name" value="${
          isNewConnection ? "" : name
        }" ${isNewConnection ? "" : "readonly"}>
			</div>
			<div class="grid-item grid-1">
				<label for="url">Siebel REST API Base URI</label></div><div class="grid-item grid-24">
				<input type="text" class="input" name="url" id="url" value="${url}" placeholder="https://Server Name:Port/siebel/v1.0">
			</div>
			<div class="grid-item grid-1">
			<label for="username">Username</label></div><div class="grid-item grid-24"> 
			<input type="text" class="input" name="username" id="username" value="${username}">
			</div>
			<div class="grid-item grid-1">
			<label for="password">Password</label></div><div class="grid-item grid-24">
			<input type="password" class="input" name="username" id="password" value="${password}">
			</div>
	${
    isNewConnection
      ? ""
      : `
			<div class="grid-item  grid-1">
				<label for="add-workspace">Workspaces
			</div>
			<div class="grid-item  grid-2">
				<input class="input" type="text" name="add-workspace" id="add-workspace">
			</div>
			<div class="grid-item grid-34">
				<Button class="button button-small" name="add" onclick="editWorkspaces()" id="add-workspace-button">Add</Button>			
			</div>
	${workspaceList}`
  }
			${
        isNewConnection
          ? ""
          : `
					<div class="grid-item grid-1 checkbox-container"> 
						<input type="checkbox" class="checkbox" name="rest-workspaces" id="rest-workspaces" ${
              restWorkspaces ? "checked" : ""
            } onchange="restWorkspaces()">			
					</div>
					<div class="grid-item grid-2"> 
						<label for="rest-workspaces">Get Workspaces From The Siebel REST API</label>
					</div>
					<div class="grid-item grid-1 checkbox-container"> 
					<input type="checkbox" class="checkbox" name="default-connection" id="default-connection" ${
            defaultConnectionName === name ? "checked" : ""
          }>				
					</div>
					<div class="grid-item grid-2"> 
						<label for="default-connection">Default Connection</label>
					</div>`
      }
			<div class="grid-item grid-1">
				<Button class="button" id="test" onclick="testConnection()">Test Connection</Button>  
			</div>
			<div class="grid-item ${isNewConnection ? "grid-24" : "grid-23"} ">
				<Button class="button" id="createOrUpdateConnection" onclick="createOrUpdateConnection()">Save Connection</Button>
			</div>  
	${
    isNewConnection
      ? ""
      : `
			<div class="grid-item grid-3">
				<Button class="button" id="deleteConnection" onclick="deleteConnection()">Delete Connection</Button>
			</div>`
  }
		</div>
		<script>
			const vscode = acquireVsCodeApi(),
				addWorkspace = document.getElementById("add-workspace");
			if (addWorkspace){
				addWorkspace.addEventListener("keypress", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						document.getElementById("add-workspace-button").click();
					}
				});
			}
			const editWorkspaces = () => {
				const name = document.getElementById("connection-name").value, 
					action = event.target.name,
					workspace = action === "add" ? document.getElementById("add-workspace").value : event.target.parentNode.dataset.value;
				if (!workspace) return;
				vscode.postMessage({command: "workspace", name, action, workspace});
			}
			const restWorkspaces = () => {
				const url = document.getElementById("url").value,
					username = document.getElementById("username").value,
					password = document.getElementById("password").value,
					restWorkspaces = document.getElementById("rest-workspaces").checked;
			if (restWorkspaces) vscode.postMessage({command: "restWorkspaces", url, username, password});
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
					restWorkspaces = !!document.getElementById("rest-workspaces")?.checked,
					defaultConnection = !!document.getElementById("default-connection")?.checked;
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
