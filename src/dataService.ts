import { default as axios } from "axios";
import { parse } from "path";
import * as vscode from "vscode";
import {
  ERR_FILE_FUNCTION_NAME_DIFF,
  ERR_NO_UPDATE,
  GET,
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
  PATH_APPLICATION,
  INF_CONN_WORKING,
  ERR_NO_BASE_WS_IOB,
  INF_GET_REST_WORKSPACES,
  ERR_NO_EDITABLE_WS,
  ERR_CONN_MISSING_PARAMS,
} from "./constants";
import { getConnection, getParentFolder, joinUrl } from "./utility";
import { writeFile } from "./utility";

const axiosInstance: IAxiosInstance = async (
  { url, username, password },
  method,
  paramsOrPayload
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

export const testConnection = async (
  url: string,
  username: string,
  password: string
) => {
  if (!(url && username && password))
    return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
  const data = await axiosInstance(
    { url: joinUrl(url, PATH_APPLICATION), username, password },
    GET,
    baseQueryParams
  );
  if (data.length !== 0) vscode.window.showInformationMessage(INF_CONN_WORKING);
};

export const checkBaseWorkspaceIOB = async (
  url: string,
  username: string,
  password: string
) => {
  if (!(url && username && password))
    return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
  const params = {
      ...workspaceQueryParams,
      searchSpec: `Name='Base Workspace'`,
    },
    data = await axiosInstance(
      { url: joinUrl(url, PATH_MAIN_INTEG_OBJ), username, password },
      GET,
      params
    );
  data.length === 1
    ? vscode.window.showInformationMessage(INF_GET_REST_WORKSPACES)
    : vscode.window.showErrorMessage(ERR_NO_BASE_WS_IOB);
};

export const getWorkspaces = async (
  url: string,
  username: string,
  password: string
): Promise<string[]> => {
  const params = {
      ...workspaceQueryParams,
      searchSpec: `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`,
    },
    data = await axiosInstance(
      { url: joinUrl(url, PATH_WORKSPACE_IOB), username, password },
      GET,
      params
    );
  if (data.length === 0) vscode.window.showErrorMessage(ERR_NO_EDITABLE_WS);
  return data.map(({ Name }) => Name);
};

const pushOrPull = async (action: ButtonAction) => {
  const fileUri = vscode.window.activeTextEditor!.document.uri,
    filePath = fileUri.fsPath,
    { name: fileName, ext } = parse(filePath),
    isWebTemp = ext === ".html",
    fields = isWebTemp ? DEFINITION : SCRIPT,
    offset = isWebTemp ? 0 : 1,
    parentName = getParentFolder(filePath, offset),
    type = getParentFolder(filePath, offset + 1) as SiebelObject,
    workspace = getParentFolder(filePath, offset + 2),
    connectionName = getParentFolder(filePath, offset + 3),
    connection = getConnection(connectionName);
  if (!connection.name)
    return vscode.window.showErrorMessage(
      `Connection "${connectionName}" was not found in the Connections settings!`
    );
  const { url, username, password } = connection,
    connectionParams = {
      url: joinUrl(
        url,
        WORKSPACE,
        workspace,
        repositoryObjects[type].parent,
        isWebTemp
          ? fileName
          : joinUrl(
              parentName,
              repositoryObjects[type as NotWebTemp].child,
              fileName
            )
      ),
      username,
      password,
    };
  switch (action) {
    case PULL: {
      const data = await axiosInstance(connectionParams, GET, {
          fields,
        }),
        fileContent = data?.[0]?.[fields];
      if (fileContent === undefined)
        return vscode.window.showErrorMessage(
          `${isWebTemp ? "Web template" : "Script"} was not found in Siebel!`
        );
      return await writeFile(filePath, fileContent);
    }
    case PUSH: {
      const content = await vscode.workspace.fs.readFile(fileUri),
        fileContent = Buffer.from(content).toString(),
        payload: Payload = { Name: fileName, [fields]: fileContent },
        pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
      if (
        !isWebTemp &&
        fileName !== "(declarations)" &&
        !pattern.test(fileContent)
      )
        return vscode.window.showErrorMessage(ERR_FILE_FUNCTION_NAME_DIFF);
      if (type !== WEBTEMP) payload["Program Language"] = "JS";
      const uploadStatus = await axiosInstance(connectionParams, PUT, payload);
      return uploadStatus !== 200
        ? vscode.window.showErrorMessage(ERR_NO_UPDATE)
        : vscode.window.showInformationMessage(
            `Successfully updated ${
              isWebTemp ? "web template" : "script"
            } in Siebel!`
          );
    }
  }
};

export const pushOrPullCallback = (action: ButtonAction) => async () => {
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
  await pushOrPull(action);
};
