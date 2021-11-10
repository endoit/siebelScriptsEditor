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
                button {
                    border: none;
                    padding: var(--input-padding-vertical) var(--input-padding-horizontal);
                    width: 100%;
                    text-align: center;
                    outline: 1px solid transparent;
                    outline-offset: 2px!important;
                    color: var(--vscode-button-foreground);
                    background: var(--vscode-button-background);
                    text-align: center;
                    font-size: 12px;
                    margin: 0 20px;
                    box-sizing: border-box;
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
                <div class="divitem">    
                    <Button class="button" onclick="postMessage()">Get Siebel Data</Button>
                </div>
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