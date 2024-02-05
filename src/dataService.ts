import { default as axios } from "axios";
import { existsSync } from "fs";
import { dirname, parse, join } from "path";
import * as vscode from "vscode";
import {
  CONFIG_DATA,
  CONNECTION,
  ERR_FILE_FUNCTION_NAME_DIFF,
  ERR_NO_INFO_JSON,
  ERR_NO_UPDATE,
  GET,
  FILE_NAME_INFO,
  INTERCEPTOR,
  PATH_MAIN_INTEG_OBJ,
  PATH_WORKSPACE_IOB,
  PULL,
  PUSH,
  PUT,
  REPOSITORY_OBJECT,
  WEBTEMP,
  WORKSPACE,
  WORKSPACE_QUERY_PARAMS,
  QUERY_PARAMS,
  DEFINITION,
  SCRIPT,
  ERR_NO_INFO_JSON_ENTRY,
} from "./constants";
import { GlobalState, joinUrl } from "./utility";
import { writeFile } from "./fileRW";

export const createInterceptor = (globalState: GlobalState) => {
  const connection = globalState.get(CONNECTION);
  if (!connection) return 0;
  const workspace = globalState.get(WORKSPACE),
    { url, username, password } = globalState.get(CONFIG_DATA)[connection];
  let interceptor = globalState.get(INTERCEPTOR);
  axios.interceptors.request.eject(interceptor);
  interceptor = axios.interceptors.request.use((config) => {
    config.headers["Content-Type"] = "application/json";
    return {
      ...config,
      baseURL: joinUrl(url, WORKSPACE, workspace, "/"),
      method: GET,
      withCredentials: true,
      auth: { username, password },
      params: {
        ...config.params,
        ...QUERY_PARAMS,
      },
    };
  });
  globalState.update(INTERCEPTOR, interceptor)!;
};

export const getDataFromRESTAPI = async (
  url: string,
  fields: QueryParams["fields"],
  searchSpec?: string
): Promise<ScriptResponse[] | WebTempResponse[]> => {
  try {
    const params: QueryParams = { fields };
    if (searchSpec) params["searchSpec"] = `Name LIKE '${searchSpec}*'`;
    const response = await axios({ url, params });
    return response.data.items;
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

const callRESTAPIInstance = async (
  { url, username, password }: Connection,
  method: RestMethod,
  paramsOrPayload: QueryParams | Payload
) => {
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
        const params = {
            ...QUERY_PARAMS,
            ...paramsOrPayload,
          },
          response = await instance.get(url, { params });
        return response.data.items;
      }
      case PUT: {
        return await instance.put(url, paramsOrPayload);
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

//check for workspace integration object
export const checkBaseWorkspaceIOB = async ({
  url,
  username,
  password,
}: Connection) => {
  const params = {
      ...WORKSPACE_QUERY_PARAMS,
      searchSpec: `Name='Base Workspace'`,
    },
    workspacesUrl = joinUrl(url, PATH_MAIN_INTEG_OBJ),
    data = await callRESTAPIInstance(
      { url: workspacesUrl, username, password },
      GET,
      params
    );
  return data.length === 1;
};

//get workspaces from REST
export const getWorkspaces = async ({
  url,
  username,
  password,
}: Connection): Promise<string[]> => {
  const params = {
      ...WORKSPACE_QUERY_PARAMS,
      searchSpec: `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`,
    },
    workspacesUrl = joinUrl(url, PATH_WORKSPACE_IOB),
    workspaces = [],
    data = await callRESTAPIInstance(
      { url: workspacesUrl, username, password },
      GET,
      params
    );
  for (let workspace of data) {
    workspaces.push(workspace.Name);
  }
  return workspaces;
};

//push/pull script from/to database
export const pushOrPullScript = async (
  action: ButtonAction,
  globalState: GlobalState
) => {
  const fileUri = vscode.window.activeTextEditor!.document.uri,
    filePath = fileUri.fsPath,
    { name: fileName } = parse(filePath),
    infoFilePath = join(dirname(filePath), FILE_NAME_INFO),
    infoFileUri = vscode.Uri.file(infoFilePath);
  if (!existsSync(infoFilePath))
    return vscode.window.showErrorMessage(ERR_NO_INFO_JSON);
  const readInfo = await vscode.workspace.fs.readFile(infoFileUri),
    infoJSON: InfoObject = JSON.parse(Buffer.from(readInfo).toString()),
    isWebTemp = infoJSON.type === WEBTEMP,
    field = isWebTemp ? DEFINITION : SCRIPT,
    dateInfoObjectKey = `${field.toLowerCase()}s` as "definitions" | "scripts",
    isInfo = infoJSON[dateInfoObjectKey]!.hasOwnProperty(fileName);
  if (!isInfo && (isWebTemp || action === PULL))
    return vscode.window.showErrorMessage(ERR_NO_INFO_JSON_ENTRY);
  const { connection, workspace, type, siebelObjectName = "" } = infoJSON,
    connectionObject = globalState.get(CONFIG_DATA)[connection];
  if (!connectionObject)
    return vscode.window.showErrorMessage(
      `Connection "${connection}" was not found in the Connections settings!`
    );
  const { url, username, password }: Connection = connectionObject,
    urlPath = joinUrl(
      url,
      WORKSPACE,
      workspace,
      REPOSITORY_OBJECT[type].parent,
      isWebTemp
        ? fileName
        : joinUrl(siebelObjectName, REPOSITORY_OBJECT[type].child, fileName)
    ),
    connectionParams = {
      url: urlPath,
      username,
      password,
    };
  switch (action) {
    case PULL: {
      const data = await callRESTAPIInstance(connectionParams, GET, {
          fields: field,
        }),
        content = data[0][field];
      if (!content) return;
      writeFile(filePath, content);
      infoJSON[dateInfoObjectKey]![fileName]["last update from Siebel"] =
        new Date().toISOString();
      break;
    }
    case PUSH: {
      const content = await vscode.workspace.fs.readFile(fileUri),
        fileContent = Buffer.from(content).toString(),
        payload: Payload = { Name: fileName, [field]: fileContent };
      if (!isInfo) {
        const answer = await vscode.window.showInformationMessage(
          `Script was not found in info.json, would you like to create this file as a new method of the Siebel Object?`,
          "Yes",
          "No"
        );
        if (answer !== "Yes") return;
        const pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
        if (!pattern.test(fileContent))
          return vscode.window.showErrorMessage(ERR_FILE_FUNCTION_NAME_DIFF);
        payload["Program Language"] = "JS";
      }
      const response = await callRESTAPIInstance(
        connectionParams,
        PUT,
        payload
      );
      if (response.status !== 200)
        return vscode.window.showErrorMessage(ERR_NO_UPDATE);
      vscode.window.showInformationMessage(
        `Successfully updated ${
          isWebTemp ? "web template" : "script"
        } in Siebel!`
      );
      if (!isInfo)
        infoJSON[dateInfoObjectKey]![fileName] = {
          "last update from Siebel": "",
          "last push to Siebel": "",
        };
      infoJSON[dateInfoObjectKey]![fileName]["last push to Siebel"] =
        new Date().toISOString();
      break;
    }
  }
  await writeFile(infoFilePath, JSON.stringify(infoJSON, null, 2));
};
