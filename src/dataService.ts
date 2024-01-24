import { default as axios } from "axios";
import { existsSync, readdirSync } from "fs";
import { basename, dirname, extname, parse } from "path";
import * as vscode from "vscode";
import {
  ERR_FILE_FUNCTION_NAME_DIFF,
  ERR_NO_INFO_JSON,
  ERR_NO_SCRIPT_INFO,
  ERR_NO_UPDATE,
  ERR_NO_WEBTEMP_INFO,
  GET,
  PULL,
  PUSH,
  PUT,
  RESOURCE_URL,
  WEBTEMP,
} from "./constants";

const getDataFromRESTAPI = async (
  url: string,
  params: QueryParams
): Promise<ScriptResponse[] | WebTempResponse[]> => {
  try {
    const response = await axios({
      url,
      method: GET,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
      params,
    });
    return response.data?.items;
  } catch (err: any) {
    if (err.response?.status !== 404) {
      vscode.window.showErrorMessage(
        `Error using the Siebel REST API: ${
          err.response?.data?.ERROR || err.message
        }`
      );
    }
    return [];
  }
};

export const callRESTAPIInstance = async (
  { url, username, password }: Connection,
  method: RestMethod,
  params: QueryParams,
  data?: Payload
) => {
  const instance = axios.create({
    withCredentials: true,
    auth: { username, password },
    headers: {
      "Content-Type": "application/json",
    },
    params,
  });
  try {
    switch (method) {
      case GET: {
        const response = await instance.get(url);
        return response.data?.items;
      }
      case PUT: {
        const response = await instance.put(url, data);
        return response;
      }
    }
  } catch (err: any) {
    if (err.response?.status !== 404) {
      vscode.window.showErrorMessage(
        `Error using the Siebel REST API: ${
          err.response?.data?.ERROR || err.message
        }`
      );
    }
    return [];
  }
};

//get siebel objects
export const getSiebelData = async (
  searchSpec: string,
  folder: string,
  type: SiebelObject
): Promise<ScriptObject | WebTempObject> => {
  const wsPath = vscode.workspace?.workspaceFolders?.[0].uri.fsPath!;
  let siebObj: ScriptObject | WebTempObject = {};
  const objectUrl = `/${RESOURCE_URL[type].obj}`;
  let exists: boolean;
  let fileNames: string[];
  const data = await getDataFromRESTAPI(objectUrl, {
    pageSize: 20,
    fields: "Name",
    childLinks: "None",
    uniformresponse: "y",
    searchSpec,
  });
  data?.forEach((row) => {
    if (type !== WEBTEMP) {
      siebObj = siebObj as ScriptObject;
      exists = existsSync(`${wsPath}/${folder}/${type}/${row.Name}`);
      siebObj[row.Name] = { scripts: {}, onDisk: exists };
      if (exists) {
        fileNames = readdirSync(`${wsPath}/${folder}/${type}/${row.Name}`);
        fileNames.forEach((file) => {
          const fileExtension = extname(file);
          if (fileExtension === ".js" || fileExtension === ".ts") {
            siebObj = siebObj as ScriptObject;
            siebObj[row.Name].scripts[basename(file, fileExtension)] = {
              onDisk: true,
            };
          }
        });
      }
    } else {
      siebObj = siebObj as WebTempObject;
      exists = existsSync(`${wsPath}/${folder}/${type}/${row.Name}.html`);
      siebObj[row.Name] = { definition: "", onDisk: exists };
    }
  });
  return siebObj;
};

//get all scripts for siebel object, or only the script names
export const getServerScripts = async (
  selectedObj: Selected,
  type: Exclude<SiebelObject, "webtemp">,
  namesOnly = false
): Promise<Scripts> => {
  const wsPath = vscode.workspace?.workspaceFolders?.[0].uri.fsPath!;
  const folderPath = `${selectedObj.connection}/${selectedObj.workspace}/${type}`;
  const scriptObj: Scripts = {};
  const objectUrl = `/${RESOURCE_URL[type].obj}/${selectedObj[type].name}/${RESOURCE_URL[type].scr}`;
  const data: ScriptResponse[] = await getDataFromRESTAPI(objectUrl, {
    pageSize: 100,
    fields: `Name${namesOnly ? "" : ",Script"}`,
    uniformresponse: "y",
  });
  data?.forEach((row) => {
    const fileNameNoExt = `${wsPath}/${folderPath}/${selectedObj[type].name}/${row.Name}`;
    scriptObj[row.Name] = {
      script: row.Script || "",
      onDisk: namesOnly
        ? existsSync(`${fileNameNoExt}.js`) || existsSync(`${fileNameNoExt}.ts`)
        : true,
    };
  });
  return scriptObj;
};

//get selected method for siebel object
export const getServerScriptMethod = async (
  selectedObj: Selected,
  type: Exclude<SiebelObject, "webtemp">
) => {
  const objectUrl = `/${RESOURCE_URL[type].obj}/${selectedObj[type].name}/${RESOURCE_URL[type].scr}/${selectedObj[type].childName}`;
  const data: ScriptResponse[] = await getDataFromRESTAPI(objectUrl, {
    fields: "Script",
    uniformresponse: "y",
  });
  return data[0]?.Script!;
};

//get web template
export const getWebTemplate = async (selectedObj: Selected) => {
  const objectUrl = `/${RESOURCE_URL[WEBTEMP].obj}/${selectedObj[WEBTEMP].name}`;
  const data: WebTempResponse[] = await getDataFromRESTAPI(objectUrl, {
    fields: "Definition",
    uniformresponse: "y",
  });
  const definitionString = data[0]?.Definition!;
  return definitionString;
};

//check for workspace integration object
export const checkBaseWorkspaceIOB = async ({
  url,
  username,
  password,
}: Connection): Promise<boolean> => {
  const workspacesUrl = `${url}/workspace/MAIN/Integration Object`;
  const data = await callRESTAPIInstance(
    { url: workspacesUrl, username, password },
    GET,
    {
      fields: "Name",
      searchSpec: `Name = "Base Workspace"`,
      uniformresponse: "y",
      workspace: "MAIN",
    }
  );
  return data.length === 1;
};

//get workspaces from REST
export const getWorkspaces = async ({
  url,
  username,
  password,
}: Connection): Promise<string[]> => {
  const workspacesUrl = `${url}/data/Workspace/Repository Workspace`;
  const workspaces = [];
  const data = await callRESTAPIInstance(
    { url: workspacesUrl, username, password },
    GET,
    {
      fields: "Name",
      searchSpec: `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`,
      uniformresponse: "y",
      workspace: "MAIN",
    }
  );
  for (let workspace of data) {
    workspaces.push(workspace.Name);
  }
  return workspaces;
};

//push/pull script from/to database
export const pushOrPullScript = async (
  action: ButtonAction,
  configData: Connections
): Promise<void> => {
  const currentlyOpenTabfilePath =
    vscode.window.activeTextEditor?.document?.uri?.fsPath!;
  const dirPath = dirname(currentlyOpenTabfilePath);
  const fileName = parse(currentlyOpenTabfilePath).name;
  const fileExtension = parse(currentlyOpenTabfilePath).ext;
  const filePath = vscode.Uri.file(`${dirPath}/${fileName}${fileExtension}`);
  const infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
  if (!existsSync(infoFilePath.fsPath)) {
    vscode.window.showErrorMessage(ERR_NO_INFO_JSON);
    return;
  }
  const readData = await vscode.workspace.fs.readFile(infoFilePath);
  let infoObj: ScriptInfo | WebTempInfo = JSON.parse(
    Buffer.from(readData).toString()
  );
  const isWebTemp = infoObj.type === WEBTEMP;
  const isInfo = isWebTemp
    ? (infoObj as WebTempInfo).definitions.hasOwnProperty(fileName)
    : (infoObj as ScriptInfo).scripts.hasOwnProperty(fileName);
  if (!isInfo && isWebTemp) {
    vscode.window.showErrorMessage(ERR_NO_WEBTEMP_INFO);
    return;
  }
  let isNewMethod = false;
  if (!(isInfo || isWebTemp)) {
    if (action !== PUSH) {
      vscode.window.showErrorMessage(ERR_NO_SCRIPT_INFO);
      return;
    }
    const answer = await vscode.window.showInformationMessage(
      `Script was not found in info.json, would you like to create this file as a new method of the Siebel Object?`,
      "Yes",
      "No"
    );
    if (answer === "Yes") {
      isNewMethod = true;
    } else {
      return;
    }
  }
  const { url, username, password }: Connection =
    configData[infoObj.connection];
  switch (action) {
    case PULL: {
      const resourceString = `${RESOURCE_URL[infoObj.type].obj}/${
        isWebTemp
          ? ""
          : `${(infoObj as ScriptInfo).siebelObjectName}/${
              RESOURCE_URL[infoObj.type].scr
            }/`
      }${fileName}`;
      const data: ScriptResponse[] | WebTempResponse[] =
        await callRESTAPIInstance(
          {
            url: `${url}/workspace/${infoObj.workspace}/${resourceString}`,
            username,
            password,
          },
          GET,
          { fields: isWebTemp ? "Definition" : "Script", uniformresponse: "y" }
        );
      const scriptString = isWebTemp
        ? (data[0] as WebTempResponse)?.Definition!
        : (data[0] as ScriptResponse)?.Script!;
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(filePath, {
        overwrite: true,
        ignoreIfExists: false,
      });
      await vscode.workspace.applyEdit(wsEdit);
      const writeData = Buffer.from(scriptString, "utf8");
      await vscode.workspace.fs.writeFile(filePath, writeData);
      if (isWebTemp) {
        infoObj = infoObj as WebTempInfo;
        infoObj.definitions[fileName]["last update from Siebel"] =
          new Date().toISOString();
      } else {
        infoObj = infoObj as ScriptInfo;
        infoObj.scripts[fileName]["last update from Siebel"] =
          new Date().toISOString();
      }
      break;
    }
    case PUSH: {
      const resourceString = `${RESOURCE_URL[infoObj.type].obj}/${
        isWebTemp
          ? ""
          : `${(infoObj as ScriptInfo).siebelObjectName}/${
              RESOURCE_URL[infoObj.type].scr
            }`
      }${isNewMethod ? "" : `/${fileName}`}`;
      const dataRead = await vscode.workspace.fs.readFile(filePath);
      const fileContent = Buffer.from(dataRead).toString();
      if (isNewMethod) {
        const pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
        if (!pattern.test(fileContent)) {
          vscode.window.showErrorMessage(ERR_FILE_FUNCTION_NAME_DIFF);
          return;
        }
      }
      const payload: Payload = { Name: fileName };
      if (isWebTemp) {
        payload.Definition = fileContent;
      } else {
        payload.Script = fileContent;
        if (isNewMethod) {
          payload["Program Language"] = "JS";
        }
      }
      const response = await callRESTAPIInstance(
        {
          url: `${url}/workspace/${infoObj.workspace}/${resourceString}`,
          username,
          password,
        },
        PUT,
        {},
        payload
      );
      if (response.status === 200) {
        vscode.window.showInformationMessage(
          `Successfully updated ${
            isWebTemp ? "web template" : "script"
          } in Siebel!`
        );
        if (isWebTemp) {
          infoObj = infoObj as WebTempInfo;
          infoObj.definitions[fileName]["last push to Siebel"] =
            new Date().toISOString();
        } else {
          infoObj = infoObj as ScriptInfo;
          if (isNewMethod) {
            infoObj.scripts[fileName] = {
              "last update from Siebel": "",
              "last push to Siebel": "",
            };
          }
          infoObj.scripts[fileName]["last push to Siebel"] =
            new Date().toISOString();
        }
      } else {
        vscode.window.showErrorMessage(ERR_NO_UPDATE);
      }
      break;
    }
  }
  await vscode.workspace.fs.writeFile(
    infoFilePath,
    Buffer.from(JSON.stringify(infoObj, null, 2), "utf8")
  );
};
