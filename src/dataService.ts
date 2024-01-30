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

export const callRESTAPIInstance: OverloadedCallRESTAPIInstance =
  async function (
    { url, username, password }: Connection,
    method: RestMethod,
    params: QueryParams | Payload
  ): Promise<any> {
    const instance = axios.create({
      withCredentials: true,
      auth: { username, password },
      headers: {
        "Content-Type": "application/json",
      },
    });
    try {
      switch (method) {
        case GET: {
          const response = await instance.get(url, { params });
          return response.data?.items;
        }
        case PUT: {
          const response = await instance.put(url, params);
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

export const getSiebelData = async (
  searchSpec: string,
  folder: string,
  type: SiebelObject
): Promise<WebTempObject | ScriptObject> => {
  const folderPath = `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/${folder}/${type}`,
    objectUrl = `/${RESOURCE_URL[type].obj}`,
    data = await getDataFromRESTAPI(objectUrl, {
      pageSize: 20,
      fields: "Name",
      childLinks: "None",
      uniformresponse: "y",
      searchSpec: `Name LIKE "${searchSpec}*"`,
    });
  if (type === WEBTEMP) {
    const siebObj: WebTempObject = {};
    for (let row of data) {
      siebObj[row.Name] = existsSync(`${folderPath}/${row.Name}.html`);
    }
    return siebObj;
  }
  const siebObj: ScriptObject = {};
  for (let row of data) {
    const exists = existsSync(`${folderPath}/${row.Name}`);
    siebObj[row.Name] = {};
    if (!exists) continue;
    const fileNames = readdirSync(`${folderPath}/${row.Name}`);
    for (let file of fileNames) {
      siebObj[row.Name][basename(file, extname(file))] = true;
    }
  }
  return siebObj;
};

//get all scripts for siebel object, or only the script names
export const getServerScripts = async (
  selectedObj: Selected,
  namesOnly = false
) => {
  const type = selectedObj.object,
    folderPath = `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/${selectedObj.connection}/${selectedObj.workspace}/${type}/${selectedObj[type].name}`,
    scriptObj: Content = {},
    objectUrl = `/${RESOURCE_URL[type].obj}/${selectedObj[type].name}/${RESOURCE_URL[type].scr}`,
    data: ScriptResponse[] = await getDataFromRESTAPI(objectUrl, {
      pageSize: 100,
      fields: `Name${namesOnly ? "" : ",Script"}`,
      uniformresponse: "y",
      childLinks: "None",
    });
  for (let row of data) {
    const fileNameNoExt = `${folderPath}/${row.Name}`;
    scriptObj[row.Name] = {
      content: row.Script || "",
      onDisk: namesOnly
        ? existsSync(`${fileNameNoExt}.js`) || existsSync(`${fileNameNoExt}.ts`)
        : true,
    };
  }
  return scriptObj;
};

//get selected method for siebel object
export const getServerScriptMethod = async (
  selectedObj: Selected,
  type: Exclude<SiebelObject, "webtemp">
) => {
  const objectUrl = `/${RESOURCE_URL[type].obj}/${selectedObj[type].name}/${RESOURCE_URL[type].scr}/${selectedObj[type].childName}`,
    data: ScriptResponse[] = await getDataFromRESTAPI(objectUrl, {
      fields: "Script",
      uniformresponse: "y",
      childLinks: "None",
    });
  return data[0]?.Script!;
};

//get web template
export const getWebTemplate = async (selectedObj: Selected) => {
  const objectUrl = `/${RESOURCE_URL[WEBTEMP].obj}/${selectedObj[WEBTEMP].name}`,
    data: WebTempResponse[] = await getDataFromRESTAPI(objectUrl, {
      fields: "Definition",
      uniformresponse: "y",
      childLinks: "None",
    });
  return data[0]?.Definition!;
};

//check for workspace integration object
export const checkBaseWorkspaceIOB = async ({
  url,
  username,
  password,
}: Connection) => {
  const workspacesUrl = `${url}/workspace/MAIN/Integration Object`,
    data = await callRESTAPIInstance(
      { url: workspacesUrl, username, password },
      GET,
      {
        fields: "Name",
        searchSpec: `Name = "Base Workspace"`,
        uniformresponse: "y",
        workspace: "MAIN",
        childLinks: "None",
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
  const workspacesUrl = `${url}/data/Workspace/Repository Workspace`,
    workspaces = [],
    data = await callRESTAPIInstance(
      { url: workspacesUrl, username, password },
      GET,
      {
        fields: "Name",
        searchSpec: `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`,
        uniformresponse: "y",
        workspace: "MAIN",
        childLinks: "None",
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
): Promise<any> => {
  const activeFilePath = vscode.window.activeTextEditor?.document?.uri?.fsPath!,
    dirPath = dirname(activeFilePath),
    { name: fileName, ext: fileExtension } = parse(activeFilePath),
    filePath = vscode.Uri.file(`${dirPath}/${fileName}${fileExtension}`),
    infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
  if (!existsSync(infoFilePath.fsPath))
    return vscode.window.showErrorMessage(ERR_NO_INFO_JSON);
  const readData = await vscode.workspace.fs.readFile(infoFilePath);
  let infoObj: ScriptInfo | WebTempInfo = JSON.parse(
    Buffer.from(readData).toString()
  );
  const isWebTemp = infoObj.type === WEBTEMP,
    isInfo = isWebTemp
      ? (infoObj as WebTempInfo).definitions.hasOwnProperty(fileName)
      : (infoObj as ScriptInfo).scripts.hasOwnProperty(fileName);
  if (!isInfo && isWebTemp)
    return vscode.window.showErrorMessage(ERR_NO_WEBTEMP_INFO);
  let isNewMethod = false;
  if (!(isInfo || isWebTemp)) {
    if (action !== PUSH)
      return vscode.window.showErrorMessage(ERR_NO_SCRIPT_INFO);
    const answer = await vscode.window.showInformationMessage(
      `Script was not found in info.json, would you like to create this file as a new method of the Siebel Object?`,
      "Yes",
      "No"
    );
    if (answer !== "Yes") return;
    isNewMethod = true;
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
        }${fileName}`,
        data: ScriptResponse[] | WebTempResponse[] = await callRESTAPIInstance(
          {
            url: `${url}/workspace/${infoObj.workspace}/${resourceString}`,
            username,
            password,
          },
          GET,
          {
            fields: isWebTemp ? "Definition" : "Script",
            uniformresponse: "y",
            childLinks: "None",
          }
        ),
        scriptString = isWebTemp
          ? (data[0] as WebTempResponse)?.Definition!
          : (data[0] as ScriptResponse)?.Script!;
      if (!scriptString) return;
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
        }${isNewMethod ? "" : `/${fileName}`}`,
        dataRead = await vscode.workspace.fs.readFile(filePath),
        fileContent = Buffer.from(dataRead).toString();
      if (isNewMethod) {
        const pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
        if (!pattern.test(fileContent))
          return vscode.window.showErrorMessage(ERR_FILE_FUNCTION_NAME_DIFF);
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
