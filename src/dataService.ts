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
  repositoryObjects,
  WEBTEMP,
  WORKSPACE,
  workspaceQueryParams,
  baseQueryParams,
  DEFINITION,
  SCRIPT,
  ERR_NO_INFO_JSON_ENTRY,
  INFO_KEY_LAST_UPDATE,
  INFO_KEY_LAST_PUSH,
  ERR_CONN_PARAM_PARSE,
} from "./constants";
import { GlobalState, joinUrl, openSettings } from "./utility";
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
        ...baseQueryParams,
      },
    };
  });
  globalState.update(INTERCEPTOR, interceptor)!;
};

export const getDataFromSiebel: IGetDataFromSiebel = async (
  url: string,
  fields: QueryParams["fields"],
  searchSpec?: string
): Promise<ScriptResponse[] | WebTempResponse[]> => {
  try {
    const params: QueryParams = { fields };
    if (searchSpec) params["searchSpec"] = `Name LIKE '${searchSpec}*'`;
    const response = await axios({ url, params });
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

const axiosInstance: IAxiosInstance = async (
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
            ...baseQueryParams,
            ...paramsOrPayload,
          },
          response = await instance.get(url, { params });
        return response.data?.items;
      }
      case PUT: {
        const response = await instance.put(url, paramsOrPayload);
        return response.status;
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
      ...workspaceQueryParams,
      searchSpec: `Name='Base Workspace'`,
    },
    workspacesUrl = joinUrl(url, PATH_MAIN_INTEG_OBJ),
    data = await axiosInstance(
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
      ...workspaceQueryParams,
      searchSpec: `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`,
    },
    workspacesUrl = joinUrl(url, PATH_WORKSPACE_IOB),
    workspaces = [],
    data = await axiosInstance(
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
const pushOrPullScript = async (
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
    oldDateInfoKey = isWebTemp ? "definitions" : "scripts";
  if (infoJSON.hasOwnProperty(oldDateInfoKey)) {
    infoJSON.files = infoJSON[oldDateInfoKey]!;
    delete infoJSON[oldDateInfoKey];
  }
  const isInfo = infoJSON.files.hasOwnProperty(fileName);
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
      repositoryObjects[type].parent,
      isWebTemp
        ? fileName
        : joinUrl(
            siebelObjectName,
            repositoryObjects[type as NotWebTemp].child,
            fileName
          )
    ),
    connectionParams = {
      url: urlPath,
      username,
      password,
    };
  switch (action) {
    case PULL: {
      const data = await axiosInstance(connectionParams, GET, {
          fields: field,
        }),
        content = data[0][field];
      if (!content) return;
      writeFile(filePath, content);
      infoJSON.files[fileName][INFO_KEY_LAST_UPDATE] = new Date().toString();
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
      const uploadStatus = await axiosInstance(connectionParams, PUT, payload);
      if (uploadStatus !== 200)
        return vscode.window.showErrorMessage(ERR_NO_UPDATE);
      vscode.window.showInformationMessage(
        `Successfully updated ${
          isWebTemp ? "web template" : "script"
        } in Siebel!`
      );
      if (!isInfo)
        infoJSON.files[fileName] = {
          [INFO_KEY_LAST_UPDATE]: "",
          [INFO_KEY_LAST_PUSH]: "",
        };
      infoJSON.files[fileName][INFO_KEY_LAST_PUSH] = new Date().toString();
      break;
    }
  }
  await writeFile(infoFilePath, JSON.stringify(infoJSON, null, 2));
};

//callback for the push/pull buttons
export const pushPullCallback =
  (action: ButtonAction, globalState: GlobalState) => async () => {
    if (!globalState.get(CONNECTION)) {
      vscode.window.showErrorMessage(ERR_CONN_PARAM_PARSE);
      return openSettings();
    }
    const answer = await vscode.window.showInformationMessage(
      `Do you want to overwrite ${
        action === PULL
          ? "the current script/web template definition from"
          : "this script/web template definition in"
      } Siebel?`,
      "Yes",
      "No"
    );
    if (answer !== "Yes") return;
    await pushOrPullScript(action, globalState);
  };
