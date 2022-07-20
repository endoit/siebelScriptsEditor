const fs = require('fs');
const vscode = require('vscode');
const path = require('path');
const axios = require('axios').default;

const resourceURL = {
  service: { obj: "Business Service", scr: "Business Service Server Script" },
  buscomp: { obj: "Business Component", scr: "BusComp Server Script" },
  applet: { obj: "Applet", scr: "Applet Server Script" },
  application: { obj: "Application", scr: "Application Server Script" }
};

const getDataFromRESTAPI = async (url, params) => {
  try {
    const response = await axios({
      url,
      method: "get",
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      },
      params
    });
    return response.data?.items;
  } catch (err) {
    if (err.response?.status !== 404) {
      vscode.window.showErrorMessage("Error using the Siebel REST API: " + err.message)
    };
  }
}

const callRESTAPIInstance = async ({ url, username, password }, method, params, data) => {
  console.log(data)
  const instance = axios.create({
    method,
    withCredentials: true,
    auth: { username, password },
    headers: {
      "Content-Type": "application/json"
    },
    params,
    data
  });
  try {
    const response = await instance(url);
    return method === "get" ? response.data?.items : response;
  } catch (err) {
    vscode.window.showErrorMessage("Error using the Siebel REST API: " + err.message)
  }
}

//get siebel objects
const getSiebelData = async (params, folder, type) => {
  const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const siebObj = {};
  const objectUrl = `/${resourceURL[type].obj}`;
  let exists;
  let fileNames;
  const data = await getDataFromRESTAPI(objectUrl, params);
  data?.forEach((row) => {
    exists = fs.existsSync(`${wsPath}/${folder}/${type}/${row.Name}`);
    siebObj[row.Name] = {
      scripts: {},
      onDisk: exists
    };
    if (exists) {
      fileNames = fs.readdirSync(`${wsPath}/${folder}/${type}/${row.Name}`);
      fileNames.forEach((file) => { if (path.extname(file) === ".js") { siebObj[row.Name].scripts[path.basename(file, ".js")] = { onDisk: true }; } });
    }
  });
  return siebObj;
}

//get all scripts for siebel object, or only the script names
const getServerScripts = async (selectedObj, type, namesOnly) => {
  const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const folderPath = `${selectedObj.connection}/${selectedObj.workspace}/${type}`;
  const scriptObj = {};
  const objectUrl = `/${resourceURL[type].obj}/${selectedObj[type].name}/${resourceURL[type].scr}`;
  const data = await getDataFromRESTAPI(objectUrl, { "pageSize": 100, "fields": `Name${namesOnly ? "" : ",Script"}`, "uniformresponse": "y" });
  data?.forEach((row) => { scriptObj[row.Name] = { script: row.Script || "", onDisk: namesOnly ? fs.existsSync(`${wsPath}/${folderPath}/${selectedObj[type].name}/${row.Name}.js`) : true } });
  return scriptObj;
}

//get selected method for siebel object
const getServerScriptMethod = async (selectedObj, type) => {
  const objectUrl = `/${resourceURL[type].obj}/${selectedObj[type].name}/${resourceURL[type].scr}/${selectedObj[type].childName}`;
  const data = await getDataFromRESTAPI(objectUrl, { "fields": "Script", "uniformresponse": "y" });
  const scriptStr = data[0]?.Script;
  return scriptStr;
}

//push/pull script from/to database
const pushOrPullScript = async (action, configData) => {
  let currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (path.basename(currentlyOpenTabfilePath).endsWith(".js") === false) {
    vscode.window.showErrorMessage("Currently active file is not a Siebel Object script or its extension is not .js!");
    return;
  }
  let scrName = path.basename(currentlyOpenTabfilePath, ".js");
  let dirPath = path.dirname(currentlyOpenTabfilePath);
  let infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
  if (fs.existsSync(infoFilePath.fsPath) === false) {
    vscode.window.showErrorMessage("File info.json was not found, please get the Siebel Object again from the extension!");
    return;
  }
  let readData = await vscode.workspace.fs.readFile(infoFilePath);
  let scrFilePath = vscode.Uri.file(`${dirPath}/${scrName}.js`);
  let infoObj = JSON.parse(Buffer.from(readData));
  if (infoObj.scripts.hasOwnProperty(scrName) === false) {
    vscode.window.showErrorMessage(`Script was not found in info.json, would you like to create this file as a new method of the Siebel Object?`);
    return;
  }
  const { url, username, password } = configData[infoObj.connection];

  switch (action) {
    case "pull": {
      const resourceString = `${resourceURL[infoObj.type].obj}/${infoObj.siebelObjectName}/${resourceURL[infoObj.type].scr}/${scrName}`;
      const data = await callRESTAPIInstance({ url: `${url}/workspace/${infoObj.workspace}/${resourceString}`, username, password }, "get", { "fields": "Script", "uniformresponse": "y" });
      const scriptStr = data[0]?.Script;
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(scrFilePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);
      const writeData = Buffer.from(scriptStr, 'utf8');
      vscode.workspace.fs.writeFile(scrFilePath, writeData);
      infoObj.scripts[scrName]["last update from Siebel"] = new Date().toString();
      break;
    }
    case "push": {
      const resourceString = `${resourceURL[infoObj.type].obj}/${infoObj.siebelObjectName}/${resourceURL[infoObj.type].scr}/${scrName}`;
      const scrDataRead = await vscode.workspace.fs.readFile(scrFilePath);
      const scrString = Buffer.from(scrDataRead).toString();
      const resp = await callRESTAPIInstance({ url: `${url}/workspace/${infoObj.workspace}/${resourceString}`, username, password }, "put", {}, {"Name": scrName, "Script": scrString});
      console.log(resp);
      /*if (resp.rowsAffected === 1) {
        vscode.window.showInformationMessage("Successfully updated script in the database!");
        infoObj.scripts[scrName]["last push to Siebel"] = new Date().toString();
      } else {
        //vscode.window.showErrorMessage("Update was unsuccessful, check database connection or object locking!");
      }*/
      break;
    }
    case "new": {
      break;
    }
  }
  vscode.workspace.fs.writeFile(infoFilePath, Buffer.from(JSON.stringify(infoObj, null, 2), 'utf8'));
}

exports.getSiebelData = getSiebelData;
exports.getServerScripts = getServerScripts;
exports.getServerScriptMethod = getServerScriptMethod;
exports.pushOrPullScript = pushOrPullScript;