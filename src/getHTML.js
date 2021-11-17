const HTMLPage = (dbwsrepo, db, rp, ws) => {
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
					button {
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
						<input type="checkbox" id="scr" checked>
					</div>
					<div class="divitem">
						<label for="datepick">NEWER THAN:</label>
						<input type="date" id="datepick">
					</div>
					<Button class="button" onclick="selectWS()">Get Siebel Data</Button>
					<Button class="button" id="backup" onclick="createBackup()">Create Backup</Button>  
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
						vscode.postMessage({command: "backup", repo, ws, scr, date});
					}
					const createBackup = () => {
						let repo = document.getElementById("repo").value;
						let ws = document.getElementById("ws").value;
						let scr = document.getElementById("scr").checked;
						let date = document.getElementById("datepick").value;
						vscode.postMessage({command: "backup", repo, ws, scr, date});
					} 
				</script>
			</body>
		</html>`;
}

exports.HTMLPage = HTMLPage;