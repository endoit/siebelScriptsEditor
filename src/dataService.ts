import { default as axios } from "axios";
import { existsSync } from "fs";
import { dirname, parse, join, basename } from "path";
import * as vscode from "vscode";
import {
  ERR_FILE_FUNCTION_NAME_DIFF,
  ERR_NO_INFO_JSON,
  ERR_NO_UPDATE,
  GET,
  FILE_NAME_INFO,
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
  PATH_APPLICATION,
} from "./constants";
import { getConnection, getParentFolder, joinUrl, timestamp } from "./utility";
import { writeFile } from "./utility";

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

export const testConnection = async ({
  url,
  username,
  password,
}: Connection) => {
  const testUrl = joinUrl(url, PATH_APPLICATION),
    data = await axiosInstance(
      { url: testUrl, username, password },
      GET,
      baseQueryParams
    );
  return data.length !== 0;
};

export const checkBaseWorkspaceIOB = async ({
  url,
  username,
  password,
}: Connection) => {
  if (!url) return false;
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

const pushOrPull2 = async (action: ButtonAction) => {
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
    fields = isWebTemp ? DEFINITION : SCRIPT,
    oldDateInfoKey = isWebTemp ? "definitions" : "scripts";
  if (infoJSON.hasOwnProperty(oldDateInfoKey)) {
    infoJSON.files = infoJSON[oldDateInfoKey]!;
    delete infoJSON[oldDateInfoKey];
  }
  const isInfo = infoJSON.files.hasOwnProperty(fileName);
  if (!isInfo && (isWebTemp || action === PULL))
    return vscode.window.showErrorMessage(ERR_NO_INFO_JSON_ENTRY);
  const { connection: name, workspace, type, siebelObjectName = "" } = infoJSON,
    connectionObject = getConnection(name);
  if (!connectionObject.name)
    return vscode.window.showErrorMessage(
      `Connection "${name}" was not found in the Connections settings!`
    );
  const { url, username, password }: Connection = connectionObject,
    objectUrlPath = joinUrl(
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
      url: objectUrlPath,
      username,
      password,
    };
  switch (action) {
    case PULL: {
      const data = await axiosInstance(connectionParams, GET, {
          fields,
        }),
        content = data?.[0][fields];
      if (!content) return;
      writeFile(filePath, content);
      infoJSON.files[fileName][INFO_KEY_LAST_UPDATE] = timestamp();
      break;
    }
    case PUSH: {
      const content = await vscode.workspace.fs.readFile(fileUri),
        fileContent = Buffer.from(content).toString(),
        payload: Payload = { Name: fileName, [fields]: fileContent };
      if (!isInfo) {
        const answer = await vscode.window.showInformationMessage(
          `Script was not found in info.json, would you like to create this file as a new method of the Siebel Object?`,
          "Yes",
          "No"
        );
        if (answer !== "Yes") return;
        const pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
        if (!pattern.test(fileContent) && fileName !== "(declarations)")
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
      infoJSON.files[fileName][INFO_KEY_LAST_PUSH] = timestamp();
      break;
    }
  }
  await writeFile(infoFilePath, JSON.stringify(infoJSON, null, 2));
};

const pushOrPull = async (action: ButtonAction) => {
  const fileUri = vscode.window.activeTextEditor!.document.uri,
    filePath = fileUri.fsPath,
    { name: fileName } = parse(filePath),
    isWebTemp = filePath.endsWith("html"),
    fields = isWebTemp ? DEFINITION : SCRIPT;
  let parent = "",
    type: SiebelObject,
    workspace = "",
    connectionName = "";
  if (isWebTemp) {
    type = WEBTEMP;
    workspace = getParentFolder(filePath, 2);
    connectionName = getParentFolder(filePath, 3);
  } else {
    parent = getParentFolder(filePath, 1);
    type = getParentFolder(filePath, 2) as NotWebTemp;
    workspace = getParentFolder(filePath, 3);
    connectionName = getParentFolder(filePath, 4);
  }
  const connection = getConnection(connectionName);
  if (!connection.name)
    return vscode.window.showErrorMessage(
      `Connection "${connectionName}" was not found in the Connections settings!`
    );
  const { url, username, password }: Connection = connection,
    objectUrlPath = joinUrl(
      url,
      WORKSPACE,
      workspace,
      repositoryObjects[type].parent,
      isWebTemp
        ? fileName
        : joinUrl(parent, repositoryObjects[type as NotWebTemp].child, fileName)
    ),
    connectionParams = {
      url: objectUrlPath,
      username,
      password,
    };
  switch (action) {
    case PULL: {
      const data = await axiosInstance(connectionParams, GET, {
          fields,
        }),
        content = data?.[0][fields];
      if (!content) return;
      return await writeFile(filePath, content);
    }
    case PUSH: {
      const content = await vscode.workspace.fs.readFile(fileUri),
        fileContent = Buffer.from(content).toString(),
        payload: Payload = { Name: fileName, [fields]: fileContent },
        pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
      if (!pattern.test(fileContent) && fileName !== "(declarations)")
        return vscode.window.showErrorMessage(ERR_FILE_FUNCTION_NAME_DIFF);
      if (type !== WEBTEMP) payload["Program Language"] = "JS";
      const uploadStatus = await axiosInstance(connectionParams, PUT, payload);
      if (uploadStatus !== 200)
        return vscode.window.showErrorMessage(ERR_NO_UPDATE);
      return vscode.window.showInformationMessage(
        `Successfully updated ${
          isWebTemp ? "web template" : "script"
        } in Siebel!`
      );
      break;
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
