import {
  SERVICE,
  BUSCOMP,
  APPLET,
  APPLICATION,
  WEBTEMP,
  RESOURCE_URL,
} from "./constants";

//generates the HTML page for the webview to select the REST endpoint, workspace, resource and for the searchbar
export const webViewHTML = (
  connectionObject: Connections,
  { connection, workspace, object }: Selected,
  noRESTConfig = false
): string => {
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

  if (noRESTConfig)
    return `
		<!doctype><html>
			<head>
				${css}
			</head>
			<body>
				<div class="text">Error in parsing the settings, please give at least one valid REST Endpoint configuration, and at least one workspace for that REST configuration!</div>
					<div class="divitem">
						<Button class="button-small" id="config" onclick="openConfig()">Open settings</Button>
					</div>
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const openConfig = () => {
						vscode.postMessage({command: "openConfig"});
					}
				</script>
			</body>
		</html>`;

  const connections = Object.keys(connectionObject)
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          connection === item ? "selected" : ""
        }>${item}</option>`
    )
    .join("");
  const workspaces = connectionObject[connection!]?.workspaces
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          workspace === item ? "selected" : ""
        }>${item}</option>`
    )
    .join("");
  const objects = [SERVICE, BUSCOMP, APPLET, APPLICATION, WEBTEMP]
    .map(
      (item) =>
        `<option class="opt" value="${item}" ${
          object === item ? "selected" : ""
        }>${RESOURCE_URL[item as SiebelObject].obj}
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
						<Button class="button-small" id="config" onclick="openConfig()">Open settings</Button>  
						<Button class="button-small" id="default" onclick="setDefault()">Set as default</Button>  
					</div>	
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const selectConnection = () => {
						const connectionName = document.getElementById("connection").value;
						vscode.postMessage({command: "selectConnection", connectionName});
					}
					const selectWorkspace= () => {
						const workspace = document.getElementById("workspace").value;
						vscode.postMessage({command: "selectWorkspace", workspace});
					}
					const selectObject = () => {
						const object = document.getElementById("object").value;
						vscode.postMessage({command: "selectObject", object});
					}
					const handleSearch = () => {					
						const searchString = document.getElementById("search-bar").value;
						if (searchString !== "") vscode.postMessage({command: "search", searchString});
					}
					const openConfig = () => {
						vscode.postMessage({command: "openConfig"});
					}
					const setDefault = () => {
						const connectionName = document.getElementById("connection").value;
						const workspace = document.getElementById("workspace").value;
						vscode.postMessage({command: "setDefault", connectionName, workspace});
					}
				</script>
			</body>
		</html>`;
};
