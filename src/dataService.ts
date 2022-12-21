import { default as axios } from "axios";
import adapter from "axios/lib/adapters/http";
import { existsSync, readdirSync } from "fs";
import { basename, dirname, extname, parse } from "path";
import * as vscode from "vscode";
import {
  ERR_FILE_NOT_SIEBEL_OBJ,
  ERR_NO_INFO_JSON,
  ERR_NO_SCRIPT_INFO,
  ERR_NO_UPDATE,
  ERR_NO_WEBTEMP_INFO,
  GET,
  PULL,
  PUSH,
  PUT,
  WEBTEMP,
} from "./constants";

const resourceURL = {
  service: { obj: "Business Service", scr: "Business Service Server Script" },
  buscomp: { obj: "Business Component", scr: "BusComp Server Script" },
  applet: { obj: "Applet", scr: "Applet Server Script" },
  application: { obj: "Application", scr: "Application Server Script" },
  webtemp: { obj: "Web Template", scr: "" },
} as const;

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
      adapter,
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
  method: typeof GET | typeof PUT,
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
    adapter,
  });
  try {
    if (method === GET) {
      const response = await instance.get(url);
      return response.data?.items;
    }
    if (method === PUT) {
      const response = await instance.put(url, data);
      return response;
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Error using the Siebel REST API: ${
        err.response?.data?.ERROR || err.message
      }`
    );
    return [];
  }
};


//get siebel objects
export const getSiebelData = async (
  params: QueryParams,
  folder: string,
  type: SiebelObject
): Promise<ScriptObject | WebTempObject> => {
  const wsPath = vscode.workspace?.workspaceFolders?.[0].uri.fsPath!;
  let siebObj: ScriptObject | WebTempObject = {};
  const objectUrl = `/${resourceURL[type].obj}`;
  let exists: boolean;
  let fileNames: string[];
  const data = await getDataFromRESTAPI(objectUrl, params);
  data?.forEach((row) => {
    if (type !== WEBTEMP) {
      siebObj = siebObj as ScriptObject;
      exists = existsSync(`${wsPath}/${folder}/${type}/${row.Name}`);
      siebObj[row.Name] = { scripts: {}, onDisk: exists };
      if (exists) {
        fileNames = readdirSync(`${wsPath}/${folder}/${type}/${row.Name}`);
        fileNames.forEach((file) => {
          if (extname(file) === ".js") {
            siebObj = siebObj as ScriptObject;
            siebObj[row.Name].scripts[basename(file, ".js")] = { onDisk: true };
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
  const objectUrl = `/${resourceURL[type].obj}/${selectedObj[type].name}/${resourceURL[type].scr}`;
  const data: ScriptResponse[] = await getDataFromRESTAPI(objectUrl, {
    pageSize: 100,
    fields: `Name${namesOnly ? "" : ",Script"}`,
    uniformresponse: "y",
  });
  data?.forEach((row) => {
    scriptObj[row.Name] = {
      script: row.Script || "",
      onDisk: namesOnly
        ? existsSync(
            `${wsPath}/${folderPath}/${selectedObj[type].name}/${row.Name}.js`
          )
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
  const objectUrl = `/${resourceURL[type].obj}/${selectedObj[type].name}/${resourceURL[type].scr}/${selectedObj[type].childName}`;
  const data: ScriptResponse[] = await getDataFromRESTAPI(objectUrl, {
    fields: "Script",
    uniformresponse: "y",
  });
  const scriptString = data[0]?.Script!;
  return scriptString;
};

//get web template
export const getWebTemplate = async (selectedObj: Selected) => {
  const objectUrl = `/${resourceURL[WEBTEMP].obj}/${selectedObj[WEBTEMP].name}`;
  const data: WebTempResponse[] = await getDataFromRESTAPI(objectUrl, {
    fields: "Definition",
    uniformresponse: "y",
  });
  const definitionString = data[0]?.Definition!;
  return definitionString;
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
      searchspec: `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`,
      uniformresponse: "y",
    }
  );
  for (let workspace of data) {
    workspaces.push(workspace.Name);
  }
  return workspaces;
};

//push/pull script from/to database
export const pushOrPullScript = async (
  action: typeof PUSH | typeof PULL,
  configData: Connections
): Promise<void> => {
  const currentlyOpenTabfilePath =
    vscode.window.activeTextEditor?.document?.uri?.fsPath;
  if (
    currentlyOpenTabfilePath === undefined ||
    (basename(currentlyOpenTabfilePath).endsWith(".js") === false &&
      basename(currentlyOpenTabfilePath).endsWith(".html") === false)
  ) {
    vscode.window.showErrorMessage(ERR_FILE_NOT_SIEBEL_OBJ);
    return;
  }
  const fileName = parse(currentlyOpenTabfilePath).name;
  const dirPath = dirname(currentlyOpenTabfilePath);
  const infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
  if (existsSync(infoFilePath.fsPath) === false) {
    vscode.window.showErrorMessage(ERR_NO_INFO_JSON);
    return;
  }
  const readData = await vscode.workspace.fs.readFile(infoFilePath);
  let infoObj: ScriptInfo | WebTempInfo = JSON.parse(
    Buffer.from(readData).toString()
  );
  const isWebTemp = infoObj.type === WEBTEMP;
  const filePath = vscode.Uri.file(
    `${dirPath}/${fileName}${isWebTemp ? ".html" : ".js"}`
  );
  const isInfo = isWebTemp
    ? (infoObj as WebTempInfo).definitions.hasOwnProperty(fileName)
    : (infoObj as ScriptInfo).scripts.hasOwnProperty(fileName);
  let isNewMethod = false;
  if (isInfo === false && isWebTemp === false) {
    if (action === "push") {
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
    } else {
      vscode.window.showErrorMessage(ERR_NO_SCRIPT_INFO);
      return;
    }
  } else if (isInfo === false && isWebTemp === true) {
    vscode.window.showErrorMessage(ERR_NO_WEBTEMP_INFO);
    return;
  }
  const { url, username, password }: Connection =
    configData[infoObj.connection];

  switch (action) {
    case PULL: {
      const resourceString = `${resourceURL[infoObj.type].obj}/${
        isWebTemp
          ? ""
          : `${(infoObj as ScriptInfo).siebelObjectName}/${
              resourceURL[infoObj.type].scr
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
          new Date().toString();
      } else {
        infoObj = infoObj as ScriptInfo;
        infoObj.scripts[fileName]["last update from Siebel"] =
          new Date().toString();
      }
      break;
    }
    case PUSH: {
      const resourceString = `${resourceURL[infoObj.type].obj}/${
        isWebTemp
          ? ""
          : `${(infoObj as ScriptInfo).siebelObjectName}/${
              resourceURL[infoObj.type].scr
            }`
      }${isNewMethod ? "" : `/${fileName}`}`;
      const dataRead = await vscode.workspace.fs.readFile(filePath);
      const fileContent = Buffer.from(dataRead).toString();
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
            new Date().toString();
        } else {
          infoObj = infoObj as ScriptInfo;
          if (isNewMethod) {
            infoObj.scripts[fileName] = {
              "last update from Siebel": "",
              "last push to Siebel": "",
            };
          }
          infoObj.scripts[fileName]["last push to Siebel"] =
            new Date().toString();
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
