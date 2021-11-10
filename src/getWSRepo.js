const HTMLPage = (wss, repos) => {
    return `
        <!doctype><html>
            <style>
                .container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .divitem {
                    margin: 0.2em;
                }
                #ws, #repo {
                    border-radius: 0.4em;
                    text-align: center;
                    background-color: rgba(83, 89, 93, 0.5);
                    color: rgb(204, 204, 204);
                    border: 0;
                    padding: 0.2em;
                    width: 10em;
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
                    <label>WORKSPACE: 
                    <input list="wsdl" id="ws" value="MAIN"/></label>
                        <datalist id="wsdl">
                            ${wss}
                        </datalist>
                </div>
                <div class="divitem">
                    <label>REPOSITORY: 
                    <input list="repodl" id="repo" value="Siebel Repository"/></label>
                        <datalist id="repodl">
                            ${repos}
                        </datalist>
                </div>
                    <Button class="button" onclick="postMessage()">Get Siebel Data</Button>    
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const postMessage = () => {
                    let ws = document.getElementById("ws").value;
                    let repo = document.getElementById("repo").value;
                    vscode.postMessage({ws, repo});
                }	
                </script>
            </body>
        </html>`;
}

exports.HTMLPage = HTMLPage;