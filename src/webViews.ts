import { settings } from "./settings";

const head = `<head>
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

		.select[disabled] {
			background-color: var(--vscode-disabledForeground);
			cursor: not-allowed;
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

		.button-small[hidden] {
  		visibility: hidden;
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
	</style>
</head>`;

export const dataSourceHTML = `<!doctype><html>
  ${head}
<body>
  <div class="datasource">
    <div class="grid-item grid-1">
      <label for="connection">Connection</label>
    </div>
    <div class="grid-item grid-2">
      <select name="connection" class="input select" id="connection" onchange="selectConnection()"></select>
    </div>
    <div class="grid-item grid-1">
      <label for="workspace">Workspace</label>
    </div>
    <div class="grid-item grid-2">
      <select name="workspace" class="input select" id="workspace" onchange="selectWorkspace()"></select>
    </div>
    <div class="grid-item grid-1">
      <label for="type">Object type</label>
    </div>
    <div class="grid-item grid-2">
      <select name="type" class="input select" id="type" onchange="selectType()"></select>
    </div>
    <div class="grid-item grid-12">
      <input type="search" name="search-bar" class="input" id="search-bar" oninput="handleSearch()" placeholder="Type here to search">
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi(),
			currentState = vscode.getState() ?? {},
      objectNames = {
        service: "Business Service",
        buscomp: "Business Component",
        applet: "Applet",
        application: "Application",
        webtemp: "Web Template"
      },
			createOptions = (items = [], selected, isObject = false) =>
        items.map((item) => \`<option class="option" value="\${item}" \${item === selected ? "selected" : ""}>
        \${isObject ? objectNames[item] : item}</option>\`).join(""),
      selectConnection = () => {
        const connection = document.getElementById("connection").value;
				currentState.connection = connection;
				vscode.setState(currentState);
        vscode.postMessage({ command: "connection", data: connection });
      },
      selectWorkspace = () => {
        const workspace = document.getElementById("workspace").value;
				currentState.workspace = workspace;
				vscode.setState(currentState);
        vscode.postMessage({ command: "workspace", data: workspace });
      },
      selectType= () => {
        const type = document.getElementById("type").value;
				currentState.type = type;
				vscode.setState(currentState);
        vscode.postMessage({ command: "type", data: type });
      },
      handleSearch = () => {
        const searchString = document.getElementById("search-bar").value;
				currentState.searchString = searchString;
				vscode.setState(currentState);
        if (!searchString) return;
				vscode.postMessage({ command: "search", data: searchString });
      },
			populate = () => {
				const { connections = [], connection = "", workspaces = [], workspace = "", type = "service", searchString = "" } = currentState,
					noConnection = connections.length === 0,
					noWorkspaces = noConnection || workspaces.length === 0;
				document.getElementById("connection").innerHTML = createOptions(connections, connection);
				document.getElementById("connection").disabled = noConnection;
				document.getElementById("workspace").innerHTML = createOptions(workspaces, workspace);
				document.getElementById("workspace").disabled = noWorkspaces;
				document.getElementById("type").innerHTML = createOptions(["service", "buscomp", "applet", "application", "webtemp"], type, true);
				document.getElementById("type").disabled = noWorkspaces;
				document.getElementById("search-bar").value = searchString;
				document.getElementById("search-bar").readOnly = noWorkspaces;
			};
		populate();
    window.addEventListener("message", ({ data: { connections = [], connection = "", workspaces = [], workspace = "", type = "service" } }) => {
			currentState.connections = connections;
			currentState.connection = connection;
			currentState.workspaces = workspaces;
			currentState.workspace = workspace; 
			currentState.type = type;
			currentState.searchString = "";
			vscode.setState(currentState);
			populate();
    });
  </script>
</body>
</html>`;

export const noWorkspaceFolderHTML = `<!doctype><html>
<body>
	<h2>Please open a Visual Studio Code workspace folder to use the extension!</h2>
</body>
</html>`;

export const createConfigHTML = (
  {
    name = "",
    url = "",
    username = "",
    password = "",
    workspaces = [],
    restWorkspaces = false,
    defaultWorkspace = "",
  }: Config,
  isNew = false
) => `<!doctype><html>
	${head}
	<body>
		<h1>${isNew ? "New Connection" : "Edit Connection"}</h1>
		<div class="config">
			<div class="grid-item grid-1">
				<label for="connection-name">Connection Name</label>
			</div>
			<div class="grid-item grid-24">
				<input type="text" class="input" name="connection-name" id="connection-name" oninput="enableButtons()" value=${
          isNew ? "" : `"${name}" readonly`
        }> 
			</div>
			<div class="grid-item grid-1">
				<label for="url">Siebel REST API Base URI</label>
			</div>
			<div class="grid-item grid-24">
				<input type="text" class="input" name="url" id="url" value="${url}" placeholder="https://Server Name:Port/siebel/v1.0" oninput="enableButtons()">
			</div>
			<div class="grid-item grid-1">
				<label for="username">Username</label>
			</div>
			<div class="grid-item grid-24"> 
				<input type="text" class="input" name="username" id="username" value="${username}" oninput="enableButtons()">
			</div>
			<div class="grid-item grid-1">
				<label for="password">Password</label>
			</div>
			<div class="grid-item grid-24">
				<input type="password" class="input" name="username" id="password" value="${password}" oninput="enableButtons()">
			</div>
	${
    isNew
      ? ""
      : `
			<div class="grid-item  grid-1">
				<label for="add-workspace">Workspaces
			</div>
			<div class="grid-item  grid-2">
				<input class="input" type="text" name="add-workspace" id="add-workspace" oninput="enableAddWorkspace()">
			</div>
			<div class="grid-item grid-34">
				<Button class="button button-small" name="add" onclick="editWorkspaces()" id="add-workspace-button" disabled>Add</Button>			
			</div>    
				${workspaces
          .map(
            (
              workspace
            ) => `<div class="grid-item grid-1" data-value="${workspace}">
				<Button class="button button-small" onclick="editWorkspaces()" name="default" ${
          workspace === defaultWorkspace
            ? "disabled>Default"
            : ">Set As Default"
        }</Button></div>
				<div class="grid-item grid-2">${workspace}</div>
				<div class="grid-item grid-3" data-value="${workspace}">
					<Button class="button button-small" name="delete" onclick="editWorkspaces()" ${
            workspace === "MAIN" ? "hidden" : ""
          }>Delete</Button>
				</div>`
          )
          .join("")}
			<div class="grid-item grid-1 checkbox-container"> 
				<input type="checkbox" class="checkbox" name="rest-workspaces" id="rest-workspaces" ${
          restWorkspaces ? "checked" : ""
        } onchange="testRestWorkspaces()">			
			</div>
			<div class="grid-item grid-2"> 
				<label for="rest-workspaces">Get Workspaces From The Siebel REST API</label>
			</div>
			<div class="grid-item grid-1 checkbox-container"> 
			<input type="checkbox" class="checkbox" name="default-connection" id="default-connection" ${
        settings.defaultConnectionName === name ? "checked" : ""
      }>				
			</div>
			<div class="grid-item grid-2"> 
				<label for="default-connection">Default Connection</label>
			</div>`
  } 
			<div class="grid-item grid-1">
				<Button class="button" id="test" onclick="testConnection()">Test Connection</Button>  
			</div>
			<div class="grid-item ${isNew ? "grid-24" : "grid-23"} ">
				<Button class="button" id="newOrEditConnection" onclick="newOrEditConnection()">Save Connection</Button>
			</div>  
			${
        isNew
          ? ""
          : `<div class="grid-item grid-3">
				<Button class="button" id="deleteConnection" onclick="deleteConnection()">Delete Connection</Button>
			</div>`
      }
		</div>
		<script>
		${
      isNew
        ? `document.getElementById("connection-name").focus();`
        : `const addWorkspace = document.getElementById("add-workspace"),
			enableAddWorkspace = () => {
				const addButton = document.getElementById("add-workspace-button"),
					workspace = document.getElementById("add-workspace").value,
					parts = workspace.split("_");
				addButton.disabled = !workspace || !/^[A-Za-z0-9_-]+$/.test(workspace) || (parts.length === 1 || (parts.length === 2 && parts[1] === "")) || "${workspaces}".split(",").includes(workspace);
			};				
			addWorkspace.focus();
			addWorkspace.addEventListener("keypress", (e) => {
				if (e.key !== "Enter") return;
				e.preventDefault();
				document.getElementById("add-workspace-button").click();					
			});	`
    }
			const vscode = acquireVsCodeApi(),
				getBaseParameters = () => ({ url: document.getElementById("url").value, username:  document.getElementById("username").value, password: document.getElementById("password").value }),
				editWorkspaces = () => {
					const name = document.getElementById("connection-name").value, 
						action = event.target.name;
					const	workspace = action === "add" ? document.getElementById("add-workspace").value : event.target.parentNode.dataset.value;		
					vscode.postMessage({command: "workspace", name, action, workspace});
				},
				testRestWorkspaces = () => {
					const { url, username, password } = getBaseParameters(),
						name = document.getElementById("connection-name").value,
						restWorkspaces = document.getElementById("rest-workspaces").checked;
					if (!restWorkspaces) return;
					vscode.postMessage({command: "testRestWorkspaces", url, username, password, name});
				},
				testConnection = () => {
					const { url, username, password } = getBaseParameters();
					vscode.postMessage({command: "testConnection", url, username, password});
				},
				newOrEditConnection = () => {
					const name = document.getElementById("connection-name").value,
						{ url, username, password } = getBaseParameters(),
						restWorkspaces = !!document.getElementById("rest-workspaces")?.checked,
						isDefaultConnection = !!document.getElementById("default-connection")?.checked;
					vscode.postMessage({command: "${
            isNew ? "newConnection" : "editConnection"
          }", name, url, username, password, restWorkspaces, isDefaultConnection});
				},
				deleteConnection = () => {
					const name = document.getElementById("connection-name").value;
					vscode.postMessage({command: "deleteConnection", name});
				},
				enableButtons = () => {
   			const testButton = document.getElementById("test"),
					saveButton = document.getElementById("newOrEditConnection"),
					restWorkspaces = document.getElementById("rest-workspaces"),
					name = document.getElementById("connection-name").value,
					{ url, username, password } = getBaseParameters(),
					 isDisabled = !(name && url && username && password);
					testButton.disabled = isDisabled;
    			saveButton.disabled = isDisabled;
					if (restWorkspaces) restWorkspaces.disabled = isDisabled;
				};
				enableButtons();
				window.addEventListener("message", ({ data: { uncheck } }) => {
					if (uncheck) document.getElementById("rest-workspaces").checked = false;
				});
			</script>
		</body>
	</html>`;
