import * as vscode from "vscode";
import {
  CHILD_LINKS,
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  DEFINITION,
  ERR_CONN_MISSING_PARAMS,
  ERR_FILE_FUNCTION_NAME_DIFF,
  ERR_NO_BASE_WS_IOB,
  ERR_NO_EDITABLE_WS,
  ERR_NO_UPDATE,
  FILE_NAME_JSCONFIG,
  FILE_NAME_SIEBEL_TYPES,
  FILE_NAME_TYPE_DEF,
  GET,
  INF_CONN_WORKING,
  INF_GET_REST_WORKSPACES,
  MAIN,
  NAME,
  PATH_MAIN_IOB,
  PATH_WORKSPACE_IOB,
  PULL,
  PUSH,
  PUT,
  REST_WORKSPACES,
  SCRIPT,
  TEST_CONNECTION,
  TEST_REST_WORKSPACES,
  UNIFORM_RESPONSE,
  WORKSPACE,
  repositoryObjects,
} from "./constants";
import { existsSync } from "fs";
import { join, dirname, basename, parse } from "path";
import axios from "axios";

export const writeFile = async (
  filePath: string,
  fileContent: string,
  openFile = false
) => {
  try {
    await vscode.workspace.saveAll(false);
    const fileUri = vscode.Uri.file(filePath),
      wsEdit = new vscode.WorkspaceEdit();
    wsEdit.createFile(fileUri, { overwrite: true, ignoreIfExists: false });
    await vscode.workspace.applyEdit(wsEdit);
    const fileBuffer = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(fileUri, fileBuffer);
    if (openFile)
      await vscode.window.showTextDocument(fileUri, { preview: false });
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const joinUrl = (...args: string[]) => args.join("/");

export const getSetting: IGetSetting = <T extends keyof Settings>(
  settingName: T
) =>
  vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")[
    settingName
  ] as unknown as Settings[T];

export const setSetting: ISetSetting = async (settingName, settingValue) =>
  await vscode.workspace
    .getConfiguration()
    .update(
      `siebelScriptAndWebTempEditor.${settingName}`,
      settingValue,
      vscode.ConfigurationTarget.Global
    );

export const getConnection = (connectionName: string) =>
  getSetting(CONNECTIONS).find(({ name }) => name === connectionName) ||
  ({} as Config);

export const callSiebelREST: ICallSiebelREST = async (
  action,
  url,
  username,
  password,
  fieldOrPayload?: typeof SCRIPT | typeof DEFINITION | Payload
) => {
  try {
    if (!(url && username && password))
      return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
    let params: QueryParams = {
        uniformresponse: UNIFORM_RESPONSE,
        childlinks: CHILD_LINKS,
      },
      resourceUrl = joinUrl(url, PATH_MAIN_IOB),
      method = GET,
      response,
      data,
      status;
    switch (action) {
      case TEST_CONNECTION:
        break;
      case TEST_REST_WORKSPACES:
        params.fields = NAME;
        params.workspace = MAIN;
        params.searchspec = `Name='Base Workspace'`;
        break;
      case REST_WORKSPACES:
        params.fields = NAME;
        params.workspace = MAIN;
        params.searchspec = `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`;
        resourceUrl = joinUrl(url, PATH_WORKSPACE_IOB);
        break;
      case PULL:
        params.fields = fieldOrPayload as typeof SCRIPT | typeof DEFINITION;
        resourceUrl = url;
        break;
      case PUSH:
        method = PUT;
        resourceUrl = url;
        break;
    }
    const instance = axios.create({
      withCredentials: true,
      auth: { username, password },
      headers: {
        "Content-Type": "application/json",
      },
    });

    switch (method) {
      case GET:
        response = await instance.get(resourceUrl, { params });
        data = response.data?.items;
        break;
      case PUT:
        response = await instance.put(resourceUrl, fieldOrPayload);
        status = response.status;
        break;
    }

    switch (action) {
      case TEST_CONNECTION:
        if (data.length !== 0)
          return vscode.window.showInformationMessage(INF_CONN_WORKING);
      case TEST_REST_WORKSPACES:
        return data.length === 1
          ? vscode.window.showInformationMessage(INF_GET_REST_WORKSPACES)
          : vscode.window.showErrorMessage(ERR_NO_BASE_WS_IOB);
      case REST_WORKSPACES:
        if (data.length === 0)
          return vscode.window.showErrorMessage(ERR_NO_EDITABLE_WS);
        return data.map(({ Name }: { Name: string }) => Name);
      case PULL:
        return data;
      case PUSH:
        return status;
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

const getParentFolder = (filePath: string, level = 1) => {
  while (level > 0) {
    filePath = dirname(filePath);
    level--;
  }
  return basename(filePath);
};

const pushOrPull = async (action: ButtonAction) => {
  const fileUri = vscode.window.activeTextEditor!.document.uri,
    filePath = fileUri.fsPath,
    { name: fileName, ext } = parse(filePath),
    isWebTemp = ext === ".html",
    field = isWebTemp ? DEFINITION : SCRIPT,
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
    resourceUrl = joinUrl(
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
    );
  switch (action) {
    case PULL: {
      const data = await callSiebelREST(
          PULL,
          resourceUrl,
          username,
          password,
          field
        ),
        fileContent = data?.[0]?.[field];
      if (fileContent === undefined)
        return vscode.window.showErrorMessage(
          `${isWebTemp ? "Web template" : "Script"} was not found in Siebel!`
        );
      return await writeFile(filePath, fileContent);
    }
    case PUSH: {
      const content = await vscode.workspace.fs.readFile(fileUri),
        fileContent = Buffer.from(content).toString(),
        payload: Payload = { Name: fileName, [field]: fileContent },
        pattern = new RegExp(`function\\s+${fileName}\\s*\\(`);
      if (
        !isWebTemp &&
        fileName !== "(declarations)" &&
        !pattern.test(fileContent)
      )
        return vscode.window.showErrorMessage(ERR_FILE_FUNCTION_NAME_DIFF);
      if (!isWebTemp) payload["Program Language"] = "JS";
      const uploadStatus = await callSiebelREST(
        PUSH,
        resourceUrl,
        username,
        password,
        payload
      );
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

export const pushOrPullAction = (action: ButtonAction) => async () => {
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

export const createIndexdtsAndJSConfigjson = async (
  context: vscode.ExtensionContext
) => {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath!,
      typeDefFilePath = join(workspaceFolder, FILE_NAME_TYPE_DEF),
      jsconfigFilePath = join(workspaceFolder, FILE_NAME_JSCONFIG);
    if (!existsSync(typeDefFilePath)) {
      const fileContent = await vscode.workspace.fs.readFile(
        vscode.Uri.file(context.asAbsolutePath(FILE_NAME_SIEBEL_TYPES))
      );
      await writeFile(typeDefFilePath, fileContent.toString());
      vscode.window.showInformationMessage(
        `File index.d.ts was created in ${workspaceFolder} folder!`
      );
    }

    if (existsSync(jsconfigFilePath)) return;
    const jsConfig = JSON.stringify(
      { compilerOptions: { allowJs: true, checkJs: true } },
      null,
      2
    );
    await writeFile(jsconfigFilePath, jsConfig);

    vscode.window.showInformationMessage(
      `File jsconfig.json was created in ${workspaceFolder} folder!`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const moveDeprecatedSettings = async () => {
  try {
    const {
        "REST EndpointConfigurations": connectionConfigs,
        workspaces,
        defaultConnection,
        connections,
      } = vscode.workspace.getConfiguration(
        "siebelScriptAndWebTempEditor"
      ) as unknown as Settings & {
        "REST EndpointConfigurations": string[];
        workspaces: string[];
        defaultConnection: string;
      },
      newConnections: Settings["connections"] = [],
      workspaceObject: Record<string, string[]> = {};
    let isDefault = false;
    if (!connectionConfigs || connections.length !== 0) return;
    const [defaultConnectionName = "", defaultWorkspace = ""] =
      defaultConnection?.split(":") || [];
    for (const workspace of workspaces) {
      const [name, workspaceString] = workspace.split(":");
      workspaceObject[name] = workspaceString ? workspaceString.split(",") : [];
    }
    for (const config of connectionConfigs) {
      const [connUserPwString, url] = config.split("@"),
        [name, username, password] = connUserPwString?.split("/"),
        connection = {
          name,
          username,
          password,
          url,
          workspaces: workspaceObject[name] ?? [],
          restWorkspaces: false,
          defaultWorkspace: workspaceObject[name][0] ?? "",
        };
      if (
        name === defaultConnectionName &&
        workspaceObject[name].includes(defaultWorkspace)
      ) {
        connection.defaultWorkspace = defaultWorkspace;
        isDefault = true;
      }
      newConnections.push(connection);
    }
    await setSetting(CONNECTIONS, newConnections);
    await setSetting(
      DEFAULT_CONNECTION_NAME,
      isDefault ? defaultConnectionName : newConnections[0].name
    );
    await setSetting("REST EndpointConfigurations", undefined);
    await setSetting("workspaces", undefined);
    await setSetting("defaultConnection", undefined);
    await setSetting("getWorkspacesFromREST", undefined);
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please create connections manually!`
    );
  }
};
