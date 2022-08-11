const fs = require("fs");
const vscode = require("vscode");
const path = require("path");
const axios = require("axios").default;

const resourceURL = {
  service: { obj: "Business Service", scr: "Business Service Server Script" },
  buscomp: { obj: "Business Component", scr: "BusComp Server Script" },
  applet: { obj: "Applet", scr: "Applet Server Script" },
  application: { obj: "Application", scr: "Application Server Script" },
  webtemp: { obj: "Web Template" }
};

const getDataFromRESTAPI = async (url, params) => {
  try {
    const response = await axios({
      url,
      method: "get",
      withCredentials: true,
      headers: {
        "Content-Type": "application/json"
      },
      params
    });
    return response.data?.items;
  } catch (err) {
    if (err.response?.status !== 404) {
      vscode.window.showErrorMessage(`Error using the Siebel REST API: ${err.response?.data?.ERROR || err.message}`);
    };
    return [];
  }
}

const callRESTAPIInstance = async ({ url, username, password }, method, params, data) => {
  const instance = axios.create({
    withCredentials: true,
    auth: { username, password },
    headers: {
      "Content-Type": "application/json"
    },
    params
  });
  try {
    if (method === "get") {
      const response = await instance.get(url);
      return response.data?.items;
    }
    if (method === "put") {
      const response = await instance.put(url, data);
      return response;
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Error using the Siebel REST API: ${err.response?.data?.ERROR || err.message}`);
    return [];
  }
}

//get siebel objects
const getSiebelData = async (params, folder, type) => {
  const wsPath = vscode.workspace?.workspaceFolders[0].uri.fsPath;
  const siebObj = {};
  const objectUrl = `/${resourceURL[type].obj}`;
  let exists;
  let fileNames;
  const data = await getDataFromRESTAPI(objectUrl, params);
  data?.forEach((row) => {
    if (type !== "webtemp") {
      exists = fs.existsSync(`${wsPath}/${folder}/${type}/${row.Name}`);
      siebObj[row.Name] = { scripts: {}, onDisk: exists };
      if (exists) {
        fileNames = fs.readdirSync(`${wsPath}/${folder}/${type}/${row.Name}`);
        fileNames.forEach((file) => { if (path.extname(file) === ".js") { siebObj[row.Name].scripts[path.basename(file, ".js")] = { onDisk: true }; } });
      }
    } else {
      exists = fs.existsSync(`${wsPath}/${folder}/${type}/${row.Name}.html`);
      siebObj[row.Name] = { definition: "", onDisk: exists };
    }
  });
  return siebObj;
}

//get all scripts for siebel object, or only the script names
const getServerScripts = async (selectedObj, type, namesOnly = false) => {
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

//get web template
const getWebTemplate = async (selectedObj) => {
  const objectUrl = `/${resourceURL["webtemp"].obj}/${selectedObj["webtemp"].name}`;
  const data = await getDataFromRESTAPI(objectUrl, { "fields": "Definition", "uniformresponse": "y" });
  const definitionStr = data[0]?.Definition;
  return definitionStr;
}

//get workspaces from REST
const getWorkspaces = async ({ url, username, password }) => {
  const workspacesUrl = `${url}/data/Workspace/Repository Workspace`;
  const workspaces = [];
  const data = await callRESTAPIInstance({ url: workspacesUrl, username, password }, "get", { "fields": "Name", "searchspec": `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`, "uniformresponse": "y" });
  for (let workspace of data) {
    workspaces.push(workspace.Name);
  }
  return workspaces;
}

//push/pull script from/to database
const pushOrPullScript = async (action, configData) => {
  const currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (path.basename(currentlyOpenTabfilePath).endsWith(".js") === false && path.basename(currentlyOpenTabfilePath).endsWith(".html") === false) {
    vscode.window.showErrorMessage("Currently active file is not a Siebel Object script/webtemplate or its extension is not .js/html!");
    return;
  }
  const scrName = path.parse(currentlyOpenTabfilePath).name;
  const dirPath = path.dirname(currentlyOpenTabfilePath);
  const infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
  if (fs.existsSync(infoFilePath.fsPath) === false) {
    vscode.window.showErrorMessage("File info.json was not found, please get the Siebel Object again from the extension!");
    return;
  }
  const readData = await vscode.workspace.fs.readFile(infoFilePath);
  const infoObj = JSON.parse(Buffer.from(readData));
  const isWebTemp = infoObj.type === "webtemp";
  const scrFilePath = vscode.Uri.file(`${dirPath}/${scrName}${isWebTemp ? ".html" : ".js"}`);
  const isScrInfo = isWebTemp ? infoObj.definitions.hasOwnProperty(scrName) : infoObj.scripts.hasOwnProperty(scrName);
  let isNewMethod = false;
  if (isScrInfo === false && isWebTemp === false) {
    if (action === "push") {
      const answer = await vscode.window.showInformationMessage(`Script was not found in info.json, would you like to create this file as a new method of the Siebel Object?`, "Yes", "No");
      if (answer === "Yes") {
        isNewMethod = true;
      } else {
        return;
      }
    } else {
      vscode.window.showErrorMessage(`Script was not found in info.json, please get it again from the extension!`);
      return;
    }
  } else if (isScrInfo === false && isWebTemp === true) {
    vscode.window.showErrorMessage(`Web template was not found in info.json, please get it again from the extension!`);
    return;
  }
  const { url, username, password } = configData[infoObj.connection];

  switch (action) {
    case "pull": {
      const resourceString = `${resourceURL[infoObj.type].obj}/${isWebTemp ? "" : infoObj.siebelObjectName + "/" + resourceURL[infoObj.type].scr + "/"}${scrName}`;
      const data = await callRESTAPIInstance({ url: `${url}/workspace/${infoObj.workspace}/${resourceString}`, username, password }, "get", { "fields": isWebTemp ? "Definition" : "Script", "uniformresponse": "y" });
      const scriptStr = isWebTemp ? data[0]?.Definition : data[0]?.Script;
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(scrFilePath, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);
      const writeData = Buffer.from(scriptStr, "utf8");
      vscode.workspace.fs.writeFile(scrFilePath, writeData);
      if (isWebTemp) {
        infoObj.definitions[scrName]["last update from Siebel"] = new Date().toString();
      } else {
        infoObj.scripts[scrName]["last update from Siebel"] = new Date().toString();
      }
      break;
    }
    case "push": {
      const resourceString = `${resourceURL[infoObj.type].obj}/${isWebTemp ? "" : infoObj.siebelObjectName + "/" + resourceURL[infoObj.type].scr}${isNewMethod ? "" : "/" + scrName}`;
      const scrDataRead = await vscode.workspace.fs.readFile(scrFilePath);
      const scrString = Buffer.from(scrDataRead).toString();
      const payload = { Name: scrName };
      if (isWebTemp) {
        payload.Definition = scrString;
      } else {
        payload.Script = scrString;
        if (isNewMethod) {
          payload["Program Language"] = "JS";
        }
      }
      const response = await callRESTAPIInstance({ url: `${url}/workspace/${infoObj.workspace}/${resourceString}`, username, password }, "put", {}, payload);
      if (response.status === 200) {
        vscode.window.showInformationMessage(`Successfully updated ${isWebTemp ? "web template" : "script"} in Siebel!`);
        if (isWebTemp) {
          infoObj.definitions[scrName]["last push to Siebel"] = new Date().toString();
        } else {
          if (isNewMethod) {
            infoObj.scripts[scrName] = { "last update from Siebel": "" };
          }
          infoObj.scripts[scrName]["last push to Siebel"] = new Date().toString();
        }
      } else {
        vscode.window.showErrorMessage("Update was unsuccessful, check REST API connection!");
      }
      break;
    }
  }
  vscode.workspace.fs.writeFile(infoFilePath, Buffer.from(JSON.stringify(infoObj, null, 2), "utf8"));
}

exports.callRESTAPIInstance = callRESTAPIInstance;
exports.getSiebelData = getSiebelData;
exports.getServerScripts = getServerScripts;
exports.getServerScriptMethod = getServerScriptMethod;
exports.getWebTemplate = getWebTemplate;
exports.getWorkspaces = getWorkspaces;
exports.pushOrPullScript = pushOrPullScript;