import * as vscode from "vscode";
import {
  error,
  openFileOptions,
  query,
  findInFilesOptions,
  settings,
  restApi,
  workspaceUri,
  compareFileUris,
  customScriptItem,
  newScriptOptions,
  fields,
  paths,
  projectInput,
  projectOptions,
  serviceInput,
  itemStates,
  APPLET,
  APPLICATION,
  BUSCOMP,
  SERVICE,
  WEBTEMP,
  scriptMeta,
  jsConfigFile,
  typeFolderUri,
  fieldMapStart,
  fieldMapEnd,
  yesNo,
  fieldMapFileUri,
} from "./constants";

export const getConfig = (name: string) => {
  for (const config of settings) {
    if (config.name !== name) continue;
    return config;
  }
  return <Config>{};
};

export const setConfigs = async () =>
  await vscode.workspace
    .getConfiguration("siebelScriptAndWebTempEditor")
    .update("connections", settings, vscode.ConfigurationTarget.Global);

export const setButtonVisibility = (visibility: Partial<ButtonVisibility>) => {
  for (const [button, isEnabled] of Object.entries(visibility)) {
    vscode.commands.executeCommand(
      "setContext",
      `siebelscriptandwebtempeditor.${button}Enabled`,
      isEnabled
    );
  }
};

export const joinPath = (...parts: string[]) => parts.join("/");

export const getObject = async (
  action: RestAction,
  { url: baseURL, username, password, maxPageSize = 100 }: RestConfig,
  path: string,
  params?: QueryParams
): Promise<RestResponse> => {
  try {
    const request = {
        baseURL,
        auth: { username, password },
        params: {
          ...(params ?? query[action]),
          PageSize: maxPageSize,
        },
      },
      response = await restApi.get(path, request),
      data = response?.data?.items ?? [];
    return data;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      err.response?.status === 404
        ? error[action]
        : err.response?.data?.ERROR ?? err.message
    );
    return [];
  }
};

export const putObject = async (
  { url: baseURL, username, password }: RestConfig,
  path: string,
  data: Payload
) => {
  try {
    const request = { baseURL, auth: { username, password } };
    await restApi.put(path, data, request);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Error using the Siebel REST API: ${
        err.response?.data?.ERROR ?? err.message
      }`
    );
    return false;
  }
};

export const exists = async (resourceUri: vscode.Uri) => {
  try {
    await vscode.workspace.fs.stat(resourceUri);
    return true;
  } catch (err: any) {
    return false;
  }
};

export const isFileScript = (ext: string): ext is "js" | "ts" =>
  ext === "js" || ext === "ts";

export const isFileWebTemp = (ext: string): ext is "html" => ext === "html";

export const isTypeScript = (type: string): type is Script =>
  type === SERVICE ||
  type === BUSCOMP ||
  type === APPLET ||
  type === APPLICATION;

export const isTypeWebTemp = (type: string): type is WebTemp =>
  type === WEBTEMP;

const createGetFilesOnDisk =
  (isFileValid: (ext: string) => ext is FileExt) =>
  async (folderUri: vscode.Uri) => {
    const files: OnDisk = new Map(),
      isFolder = await exists(folderUri);
    if (!isFolder) return files;
    const content = await vscode.workspace.fs.readDirectory(folderUri);
    for (const [nameExt, fileType] of content) {
      const [name, ext] = nameExt.split(".");
      if (!name || fileType !== 1 || !isFileValid(ext)) continue;
      files.set(name, ext);
    }
    return files;
  };

export const getScriptsOnDisk = createGetFilesOnDisk(isFileScript);
export const getWebTempsOnDisk = createGetFilesOnDisk(isFileWebTemp);

export const getScriptParentsOnDisk = async (folderUri: vscode.Uri) => {
  const folders: RestResponse = [],
    isFolder = await exists(folderUri);
  if (!isFolder) return folders;
  const content = await vscode.workspace.fs.readDirectory(folderUri);
  for (const [Name, fileType] of content) {
    if (fileType !== 2) continue;
    folders.push({ Name });
  }
  return folders;
};

export const createFolder = async (...parts: string[]) => {
  const folderUri = vscode.Uri.joinPath(workspaceUri, ...parts),
    isFolder = await exists(folderUri);
  if (isFolder) return;
  await vscode.workspace.fs.createDirectory(folderUri);
};

export const getLocalWorkspaces = async (connection: string) => {
  const workspaces: string[] = [],
    folderUri = vscode.Uri.joinPath(workspaceUri, connection);
  await createFolder(connection, "MAIN");
  const content = await vscode.workspace.fs.readDirectory(folderUri);
  for (const [workspace, fileType] of content) {
    if (fileType !== 2) continue;
    workspaces.push(workspace);
  }
  return workspaces;
};

export const isWorkspaceEditable = (workspace: string, config: RestConfig) =>
  workspace.includes(`_${config.username.toLowerCase()}_`);

export const createValidateWorkspaceName =
  (workspaces: string[]) => async (value: string) => {
    const parts = value.split("_");
    if (
      !value ||
      !/^[A-Za-z0-9_-]+$/.test(value) ||
      parts.length === 1 ||
      (parts.length === 2 && parts[1] === "")
    )
      return "Invalid workspace name!";
    if (workspaces.includes(value)) return "Workspace already exists!";
    return "";
  };

const isFileNameValid = (name: string) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || name === "(declarations)";

const createValidateScriptName = (files: OnDisk) => (value: string) =>
  isFileNameValid(value)
    ? files.has(value)
      ? "Script already exists!"
      : ""
    : "Invalid script name!";

export const isScriptNameValid = (name: string, content = "") =>
  new RegExp(`function\\s+${name}\\s*\\(`).test(content) ||
  name === "(declarations)";

export const getFileUri = (folderUri: vscode.Uri, name: string, ext: FileExt) =>
  vscode.Uri.joinPath(folderUri, `${name}.${ext}`);

export const openFile = async (fileUri: vscode.Uri) => {
  try {
    await vscode.window.showTextDocument(fileUri, openFileOptions);
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Unable to open ${fileUri.fsPath}, file does not exist!`
    );
  }
};

export const writeFile = async (fileUri: vscode.Uri, fileContent: string) => {
  try {
    const content = Buffer.from(fileContent, "utf8");
    await vscode.workspace.fs.writeFile(fileUri, content);
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const readFile = async (fileUri: vscode.Uri) => {
  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(content).toString("utf8");
  } catch (err: any) {
    return undefined;
  }
};

export const searchInFiles = async (folderUri: vscode.Uri, query = "") => {
  await vscode.commands.executeCommand("workbench.action.findInFiles", {
    query,
    filesToInclude: folderUri.fsPath,
    ...findInFilesOptions,
  });
};

export const createNewScriptBody = ({
  label,
  scriptArgs = "",
  isPre = false,
}: {
  label: string;
  scriptArgs?: string;
  isPre?: boolean;
}) =>
  label !== "(declarations)"
    ? `function ${label}(${scriptArgs})\n{\n${
        isPre ? "\treturn (ContinueOperation);" : ""
      }\n}`
    : "";

export const createNewScript = async (
  folderUri: vscode.Uri,
  type: Script,
  parent: string,
  fileExtension: FileExt = "js"
) => {
  const files = await getScriptsOnDisk(folderUri),
    items: (vscode.QuickPickItem & {
      scriptArgs?: string;
      isPre?: boolean;
    })[] = [customScriptItem] as const;
  for (const item of scriptMeta[type].defaultScripts) {
    if (files.has(item.label)) continue;
    items.push(item);
  }
  const answer = await vscode.window.showQuickPick(items, {
    title: `New script for ${parent}`,
    ...newScriptOptions,
  });
  if (!answer) return;
  const isCustom = answer.label === "Custom",
    label = isCustom
      ? await vscode.window.showInputBox({
          placeHolder: "Enter the name of the new server script",
          validateInput: createValidateScriptName(files),
        })
      : answer.label;
  if (!label) return;
  const name = isCustom ? { label } : answer,
    content = createNewScriptBody(name),
    fileUri = getFileUri(folderUri, label, fileExtension);
  await writeFile(fileUri, content);
  return fileUri;
};

export const createNewService = async (
  config: RestConfig,
  objectFolderUri: vscode.Uri
) => {
  const searchString = await vscode.window.showInputBox(projectInput);
  if (!searchString) return;
  const params = {
      fields: fields.name,
      searchSpec: `Name LIKE '${searchString}*'`,
    },
    projectResponse = await getObject("search", config, paths.project, params),
    items = [];
  for (const { Name: label } of projectResponse) {
    items.push({ label });
  }
  if (items.length === 0) {
    vscode.window.showErrorMessage(
      `No project name starts with the specified string "${searchString}"!`
    );
    return;
  }
  const project = await vscode.window.showQuickPick(items, projectOptions);
  if (!project) return;
  const serviceName = await vscode.window.showInputBox(serviceInput),
    serviceNameTrimmed = serviceName && serviceName.trim();
  if (!serviceNameTrimmed) return;
  const path = joinPath(SERVICE, serviceNameTrimmed),
    serviceResponse = await getObject(
      "search",
      config,
      path,
      query.testConnection
    ),
    isService = serviceResponse.length !== 0;
  if (isService) {
    vscode.window.showErrorMessage(
      `Business service ${serviceNameTrimmed} already exists!`
    );
    return;
  }
  const payload = { Name: serviceNameTrimmed, "Project Name": project.label },
    isSuccess = await putObject(config, path, payload);
  if (!isSuccess) return;
  const folderUri = vscode.Uri.joinPath(objectFolderUri, serviceNameTrimmed),
    fileUri = getFileUri(
      folderUri,
      scriptMeta[SERVICE].defaultScripts[0].label,
      config.fileExtension
    ),
    content = createNewScriptBody(scriptMeta[SERVICE].defaultScripts[0]);
  await writeFile(fileUri, content);
  return [serviceName, fileUri] as const;
};

export const compareObjects = async (
  content: string | undefined,
  ext: FileExt,
  fileUri: vscode.Uri,
  compareMessage: string
) => {
  if (content === undefined) return itemStates.differ;
  const fileContent = await readFile(fileUri);
  await writeFile(compareFileUris[ext], content);
  await vscode.commands.executeCommand(
    "vscode.diff",
    compareFileUris[ext],
    fileUri,
    compareMessage
  );
  return content === fileContent ? itemStates.same : itemStates.differ;
};

export const getHTML = async (
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
  fileName: "dataSource" | "config" | "openWorkspace"
) => {
  const fileUri = vscode.Uri.joinPath(
      extensionUri,
      "webview",
      `${fileName}.html`
    ),
    fileContent = await readFile(fileUri),
    styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "style.css")
    );
  return fileContent!.replace("./style.css", styleUri.toString());
};

export const setupWorkspaceFolder = async (extensionUri: vscode.Uri) => {
  try {
    if (!workspaceUri) return;
    const typeDefUri = vscode.Uri.joinPath(workspaceUri, "index.d.ts"),
      isTypeDef = await exists(typeDefUri),
      siebelTypesUri = vscode.Uri.joinPath(extensionUri, "siebelTypes.txt"),
      jsconfigUri = vscode.Uri.joinPath(workspaceUri, "jsconfig.json"),
      isJsconfig = await exists(jsconfigUri);
    if (!isTypeDef) {
      await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
      vscode.window.showInformationMessage(
        `File index.d.ts was created in the ${workspaceUri.fsPath} folder!`
      );
    }
    if (!isJsconfig) {
      await writeFile(jsconfigUri, jsConfigFile);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in the ${workspaceUri.fsPath} folder!`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

export const writeFieldType = async (
  buscomp: string,
  response: RestResponse
) => {
  const fieldFileUri = vscode.Uri.joinPath(
      workspaceUri,
      "fields",
      `${buscomp}.ts`
    ),
    fileExists = await exists(fieldFileUri),
    fields = [];
  if (fileExists) {
    const answer = await vscode.window.showInformationMessage(
      `Do you want to overwrite the fields for the ${buscomp} business component?`,
      ...yesNo
    );
    if (answer !== "Yes") return;
  }
  for (const { Name, PickList } of response) {
    fields.push(`"${Name}"`);
    if (!PickList) continue;
    fields.push(`"${Name}.TransCode"`);
  }
  const fieldsType = `export type Fields = ${fields.join(" | ")};`;
  await writeFile(fieldFileUri, fieldsType);
};

export const writeFieldMap = async () => {
  const isFolder = await exists(typeFolderUri),
    fieldMapRows = [];
  if (!isFolder) return;
  const content = await vscode.workspace.fs.readDirectory(typeFolderUri);
  for (const [nameExt, fileType] of content) {
    const [name, ext] = nameExt.split(".");
    if (fileType !== 1 || ext !== "ts") continue;
    fieldMapRows.push(
      `\t\t"${name}": FieldBase | import("./fields/${name}").Fields;`
    );
  }

  const fieldMap = `${fieldMapStart}${fieldMapRows.join("\n")}${fieldMapEnd}`;
  await writeFile(fieldMapFileUri, fieldMap);
};
