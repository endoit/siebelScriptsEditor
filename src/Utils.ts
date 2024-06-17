import * as vscode from "vscode";
import {
  childlinks,
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
  uniformresponse,
  WORKSPACE,
  repositoryObjects,
  headers,
} from "./constants";
import { Settings } from "./Settings";
import axios from "axios";

export class Utils {
  static async resourceExists(resourceUri: vscode.Uri) {
    try {
      await vscode.workspace.fs.stat(resourceUri);
      return true;
    } catch (err) {
      return false;
    }
  }

  static joinUri(base: vscode.Uri, ...args: string[]) {
    return vscode.Uri.joinPath(base, ...args);
  }

  static async writeFile(
    fileUri: vscode.Uri,
    fileContent: string,
    openFile = false
  ) {
    try {
      await vscode.workspace.saveAll(false);
      const wsEdit = new vscode.WorkspaceEdit();
      wsEdit.createFile(fileUri, { overwrite: true, ignoreIfExists: false });
      await vscode.workspace.applyEdit(wsEdit);
      const fileBuffer = Buffer.from(fileContent, "utf8");
      await vscode.workspace.fs.writeFile(fileUri, fileBuffer);
      if (openFile)
        await vscode.window.showTextDocument(fileUri, { preview: false });
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }

  static joinUrl(...args: string[]) {
    return args.join("/");
  }

  static async callSiebelREST(
    action: typeof TEST_CONNECTION | typeof TEST_REST_WORKSPACES,
    url: string,
    username: string,
    password: string
  ): Promise<void>;
  static async callSiebelREST(
    action: typeof REST_WORKSPACES,
    url: string,
    username: string,
    password: string
  ): Promise<string[]>;
  static async callSiebelREST(
    action: typeof PULL,
    url: string,
    username: string,
    password: string,
    fieldOrPayload: typeof SCRIPT | typeof DEFINITION
  ): Promise<string>;
  static async callSiebelREST(
    action: typeof PUSH,
    url: string,
    username: string,
    password: string,
    fieldOrPayload: Payload
  ): Promise<number>;
  static async callSiebelREST(
    action: RESTAction,
    url: string,
    username: string,
    password: string,
    fieldOrPayload?: typeof SCRIPT | typeof DEFINITION | Payload
  ) {
    try {
      if (!(url && username && password))
        return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
      const params: QueryParams = {
        uniformresponse,
        childlinks,
      };
      let resourceUrl = this.joinUrl(url, PATH_MAIN_IOB),
        method = GET,
        response,
        data;
      switch (action) {
        case TEST_REST_WORKSPACES:
          params.fields = NAME;
          params.workspace = MAIN;
          params.searchspec = `Name='Base Workspace'`;
          break;
        case REST_WORKSPACES:
          params.fields = NAME;
          params.workspace = MAIN;
          params.searchspec = `Created By Name='${username}' AND (Status='Checkpointed' OR Status='Edit-In-Progress')`;
          resourceUrl = this.joinUrl(url, PATH_WORKSPACE_IOB);
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
        headers,
      });

      switch (method) {
        case GET:
          response = await instance.get(resourceUrl, { params });
          data = response.data?.items;
          break;
        case PUT:
          response = await instance.put(resourceUrl, fieldOrPayload);
          return response.status;
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
          const workspaces = [];
          for (const { Name } of data) {
            workspaces.push(Name);
          }
          return workspaces;
        case PULL:
          return data?.[0]?.[
            fieldOrPayload as typeof SCRIPT | typeof DEFINITION
          ];
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
  }

  static pushOrPull(action: ButtonAction) {
    return async () => {
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
      const fileUri = vscode.window.activeTextEditor!.document.uri,
        fileUriParts = fileUri.path.split("/"),
        fileNameExt = fileUriParts.at(-1)!,
        [fileName, ext] = fileNameExt.split("."),
        isWebTemp = ext === "html",
        field = isWebTemp ? DEFINITION : SCRIPT,
        offset = isWebTemp ? 1 : 0,
        parentName = fileUriParts.at(offset - 2)!,
        type = fileUriParts.at(offset - 3) as SiebelObject,
        workspace = fileUriParts.at(offset - 4)!,
        connectionName = fileUriParts.at(offset - 5)!,
        connection = Settings.getConnection(connectionName);
      if (!connection.name)
        return vscode.window.showErrorMessage(
          `Connection "${connectionName}" was not found in the Connections settings!`
        );
      const { url, username, password } = connection,
        resourceUrl = this.joinUrl(
          url,
          WORKSPACE,
          workspace,
          repositoryObjects[type].parent,
          isWebTemp
            ? fileName
            : this.joinUrl(
                parentName,
                repositoryObjects[type as NotWebTemp].child,
                fileName
              )
        );
      switch (action) {
        case PULL:
          const responseContent = await this.callSiebelREST(
            PULL,
            resourceUrl,
            username,
            password,
            field
          );
          if (!responseContent || responseContent.length === 0) return;
          return await this.writeFile(fileUri, responseContent);
        case PUSH:
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
          const uploadStatus = await this.callSiebelREST(
            PUSH,
            url,
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
    };
  }

  static async createIndexdtsAndJSConfigjson(contextUri: vscode.Uri) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders![0].uri,
        typeDefFileUri = this.joinUri(workspaceFolder, FILE_NAME_TYPE_DEF),
        jsconfigFileUri = this.joinUri(workspaceFolder, FILE_NAME_JSCONFIG);
      if (!(await this.resourceExists(typeDefFileUri))) {
        const fileContent = await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(contextUri, FILE_NAME_SIEBEL_TYPES)
        );
        await this.writeFile(typeDefFileUri, fileContent.toString());
        vscode.window.showInformationMessage(
          `File index.d.ts was created in ${workspaceFolder} folder!`
        );
      }
      if (await this.resourceExists(jsconfigFileUri)) return;
      const jsConfig =
        '{\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true\n  }\n}';
      await this.writeFile(jsconfigFileUri, jsConfig);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${workspaceFolder} folder!`
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }
}
