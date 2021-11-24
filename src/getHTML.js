//generates the HTML page for the webview to select database/repository/workspace
const HTMLPage = (dbwsrepo, db, rp, ws, backup) => {
	if (!dbwsrepo || dbwsrepo === "enablereload"){
		return `
		<!doctype><html>
		<head>
			<style>
			.button {
				margin-top: 0.2em;
				border: none;
				padding: 0.5em;
				width: 100%;
				text-align: center;
				outline: 1px solid transparent;
				outline-offset: 2px!important;
				color: var(--vscode-button-foreground);
				background: var(--vscode-button-background);
				text-align: center;
				box-sizing: border-box;
				border-radius: 0.4em;
			}
			.button:disabled {
				background: #9daaab;
			}
			</style>
		</head>
		<body>
		<p>Please add at least one database configuration in the settings, test it, and then press reload.</p>
			<Button class="button" onclick="testdb()">Test database connection</Button>
			<Button class="button" onclick="reload()" ${dbwsrepo === "enablereload" ? "" : "disabled"}>Reload</Button>
			<script>
			const vscode = acquireVsCodeApi();
			const testdb = () => {vscode.postMessage({command: "testdb"});}
			const reload = () => {vscode.postMessage({command: "reload"});}
			</script>
		</body>
		</html>`
	}
	
	let dbs = Object.keys(dbwsrepo.db).map((item) => `<option class="opt" value="${item}" ${item === db ? "selected" : ""}>${item}</option>`).join('');
	let repos = Object.keys(dbwsrepo.repo).map((item) => `<option class="opt" value="${item}" ${item === rp ? "selected" : ""}>${item}</option>`).join('');
	let wss = Object.keys(dbwsrepo.ws).map((item) => `<option class="opt" value="${item}" ${item === ws ? "selected" : ""}>${item}</option>`).join('');

	return `
		<!doctype><html>
			<head>
				<style>
					.container {
						display: flex;
						flex-direction: column;
						align-items: left;
					}
					.divitem {
						margin: 0.2em;
					}
					#ws, #repo, #db, #datepick {
						border-radius: 0.4em;
						text-align: center;
						background-color: rgba(83, 89, 93, 0.5);
						color: rgb(204, 204, 204);
						border: 0;
						padding: 0.2em;
						width: 10em;
					}
					#datepick {
						width: 9em;
						font-family: inherit;
						text-align: right;
				}
				.opt, #scr {
					background: rgba(83, 89, 93, 1);
					color: rgb(204, 204, 204);
				}
				.button {
					margin-top: 0.2em;
					border: none;
					padding: 0.5em;
					width: 100%;
					text-align: center;
					outline: 1px solid transparent;
					outline-offset: 2px!important;
					color: var(--vscode-button-foreground);
					background: var(--vscode-button-background);
					text-align: center;
					box-sizing: border-box;
					border-radius: 0.4em;
				}
				.button_backup {
					margin-top: 0.2em;
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
				.button_backup:disabled {
						background: #9daaab;
				}
				.button_def {
					margin-left: 1.3em;
					color: var(--vscode-button-foreground);
					background: var(--vscode-button-background);
					text-align: center;
					border-radius: 0.4em;
					border: none;
				}
				</style>
			</head>
			<body>
				<div class="container">
					<div class="divitem">
						<label for="db">&nbsp;&nbsp;&nbsp;&nbsp;DATABASE:</label>
						<select name="dbs" id="db" onchange="selectDB()">
								${dbs}
						</select>
					</div>
					<div class="divitem">
						<label for="repo">REPOSITORY:</label> 
						<select name="wss" id="repo" value="Siebel Repository" onchange="selectRepo()">                       
								${repos}
						</select>
					</div>
					<div class="divitem">
						<label for="ws">WORKSPACE:</label> 
						<select name="wss" id="ws" value="MAIN">
								${wss}
						</select>
					</div>
					<div class="divitem">
					<label for="cb">HAS SCRIPTS:</label>
						<input type="checkbox" id="scr" checked><Button class="button_def" onclick="setDefault()">Set as default</Button>
					</div>
					<div class="divitem">
						<label for="datepick">NEWER THAN:</label>
						<input type="date" id="datepick">
					</div>
					<div class="divitem">
						<Button class="button" onclick="selectWS()">Get Siebel Data</Button>
					</div>
					<div class="divitem">
						<Button class="button_backup" id="backup" ${backup ? "" : "disabled"} onclick="createBackup()">Create backup</Button>
						<Button class="button_backup" id="config" onclick="openConfig()">Open settings</Button>  
					</div>
					<div class="divitem">
						<Button class="button" onclick="reload()">Reload</Button>
					</div>	
				</div>
				<script>
					const vscode = acquireVsCodeApi();
					const selectDB = () => {
						let db = document.getElementById("db").value;
						vscode.postMessage({command: "selectDB", db});
					}
					const selectRepo = () => {
						let repo = document.getElementById("repo").value;
						vscode.postMessage({command: "selectRepo", repo});
					}
					const selectWS = () => {
						let repo = document.getElementById("repo").value;
						let ws = document.getElementById("ws").value;
						let scr = document.getElementById("scr").checked;
						let date = document.getElementById("datepick").value;
						vscode.postMessage({command: "selectWS", repo, ws, scr, date});
					}
					const createBackup = () => {
						let repo = document.getElementById("repo").value;
						let ws = document.getElementById("ws").value;
						let scr = document.getElementById("scr").checked;
						let date = document.getElementById("datepick").value;
						vscode.postMessage({command: "backup", repo, ws, scr, date});
					}
					const setDefault = () => {
						let db = document.getElementById("db").value;
						let repo = document.getElementById("repo").value;
						let ws = document.getElementById("ws").value;
						vscode.postMessage({command: "setDefault", db, repo, ws});
					}
					const openConfig = () => {
						vscode.postMessage({command: "openConfig"});
					}
					const reload = () => {
						vscode.postMessage({command: "reload"});
					}
				</script>
			</body>
		</html>`;
}

exports.HTMLPage = HTMLPage;