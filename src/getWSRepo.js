const HTMLPage = (wss, repos) => {
    return `
        <!doctype><html>
            <body>
            <div>
                <label>Workspace: 
                <input list="wsdl" id="ws" value="MAIN"/></label>
                    <datalist id="wsdl">
                        ${wss}
                    </datalist>
            </div>
            <div>
                <label>Repository: 
                <input list="repodl" id="repo" value="Siebel Repository"/></label>
                    <datalist id="repodl">
                        ${repos}
                    </datalist>
            </div>
                <Button onclick="postMessage()">Get Business Services</Button>
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