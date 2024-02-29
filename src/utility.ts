import * as vscode from "vscode";
import {
  CONNECTIONS,
  DEFAULT_CONNECTION_NAME,
  FILE_NAME_JSCONFIG,
  FILE_NAME_SIEBEL_TYPES,
  FILE_NAME_TYPE_DEF,
} from "./constants";
import { existsSync } from "fs";
import { join } from "path";

//write/create file
export const writeFile = async (
  filePath: string,
  fileContent: string,
  openFile = false
): Promise<void> => {
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

//create url path from parts
export const joinUrl = (...args: string[]) => args.join("/");

//open the extension settings
export const openSettings = () =>
  vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "siebelScriptAndWebTempEditor"
  );

//get the settings
export const getSetting: IGetSetting = <T extends keyof Settings>(
  settingName: T
) =>
  vscode.workspace.getConfiguration("siebelScriptAndWebTempEditor")[
    settingName
  ] as unknown as Settings[T];

//set the settings
export const setSetting = async <T extends keyof Settings>(
  settingName: T,
  settingValue: Settings[T]
) =>
  await vscode.workspace
    .getConfiguration()
    .update(
      `siebelScriptAndWebTempEditor.${settingName}`,
      settingValue,
      vscode.ConfigurationTarget.Global
    );

export const getConnection = (name = "") =>
  getSetting(CONNECTIONS).find((item) => item.name === name) || ({} as Config);

export const timestamp = (now = new Date()) =>
  `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}T${now
    .getHours()
    .toString()
    .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;

//copy index.d.ts and create jsconfig.json to the VSCode workspace folder if they do not exist
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
      writeFile(typeDefFilePath, fileContent.toString());
      vscode.window.showInformationMessage(
        `File index.d.ts was created in ${workspaceFolder} folder!`
      );
    }

    if (!existsSync(jsconfigFilePath)) {
      const jsConfig = JSON.stringify(
        { compilerOptions: { allowJs: true, checkJs: true } },
        null,
        2
      );
      writeFile(jsconfigFilePath, jsConfig);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${workspaceFolder} folder!`
      );
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(err.message);
  }
};

//copy the deprecated settings if they exist to the new setting
export const moveDeprecatedSettings = async () => {
  const {
      "REST EndpointConfigurations": connectionConfigs,
      workspaces,
      defaultConnection,
      connections,
    } = vscode.workspace.getConfiguration(
      "siebelScriptAndWebTempEditor"
    ) as unknown as Settings & OldSettings,
    newConnections: Settings["connections"] = [],
    workspaceObject: Workspaces = {};
  let isDefault = false;
  try {
    if (!connectionConfigs || !(Object.keys(connections).length === 0)) return;
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
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `An error occured when moving the deprecated parameters to the new settings: ${err.message}, please create connections manually!`
    );
  }
};
