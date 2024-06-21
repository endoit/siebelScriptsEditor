import * as vscode from "vscode";
import {
  DEFINITION,
  ERR_CONN_MISSING_PARAMS,
  ERR_NAME_DIFF,
  ERR_NO_BASE_WS_IOB,
  ERR_NO_EDITABLE_WS,
  FILE_NAME_JSCONFIG,
  FILE_NAME_SIEBEL_TYPES,
  FILE_NAME_TYPE_DEF,
  GET,
  INF_CONN_WORKING,
  INF_GET_REST_WORKSPACES,
  PULL,
  PUSH,
  PUT,
  REST_WORKSPACES,
  SCRIPT,
  TEST_CONNECTION,
  TEST_REST_WORKSPACES,
  WORKSPACE,
  siebelObjects,
  withCredentials,
  INF_SUCCESSFUL_UPDATE,
  JS_CONFIG,
  constQueryParams,
  constUrl,
} from "./constants";
import { Settings } from "./Settings";
import axios from "axios";

export class Utils {
  private static readonly restApi = axios.create({ withCredentials });

  static joinUrl(...args: string[]) {
    return args.join("/");
  }

  static joinUri(base: vscode.Uri, ...args: string[]) {
    return vscode.Uri.joinPath(base, ...args);
  }

  static async resourceExists(resourceUri: vscode.Uri) {
    try {
      await vscode.workspace.fs.stat(resourceUri);
      return true;
    } catch (err) {
      return false;
    }
  }

  static async writeFile(
    fileUri: vscode.Uri,
    fileContent: string,
    openFile = false
  ) {
    try {
      const contents = Buffer.from(fileContent, "utf8");
      await vscode.workspace.fs.writeFile(fileUri, contents);
      if (openFile)
        await vscode.window.showTextDocument(fileUri, { preview: false });
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }

  static async callRestApi(
    action: typeof TEST_CONNECTION | typeof TEST_REST_WORKSPACES,
    url: string,
    username: string,
    password: string
  ): Promise<void>;
  static async callRestApi(
    action: typeof REST_WORKSPACES,
    url: string,
    username: string,
    password: string
  ): Promise<string[]>;
  static async callRestApi(
    action: typeof PULL,
    url: string,
    username: string,
    password: string,
    fieldOrPayload: Fields
  ): Promise<string>;
  static async callRestApi(
    action: typeof PUSH,
    url: string,
    username: string,
    password: string,
    fieldOrPayload: Payload
  ): Promise<void>;
  static async callRestApi(
    action: RestAction,
    url: string,
    username: string,
    password: string,
    fieldOrPayload?: Fields | Payload
  ) {
    try {
      if (!(url && username && password))
        return vscode.window.showErrorMessage(ERR_CONN_MISSING_PARAMS);
      const request: RequestConfig = {
        method: GET,
        url,
        auth: { username, password },
      };

      switch (action) {
        case PULL:
          request.params = constQueryParams[action][fieldOrPayload as Fields];
          break;
        case PUSH:
          request.method = PUT;
          request.data = fieldOrPayload as Payload;
          break;
        default:
          request.url = this.joinUrl(url, constUrl[action]);
          request.params = constQueryParams[action];
      }
      
      const response = await this.restApi(request);

      switch (action) {
        case PULL:
          return response?.data?.items?.[0]?.[fieldOrPayload as Fields];
        case PUSH:
          return vscode.window.showInformationMessage(INF_SUCCESSFUL_UPDATE);
        case TEST_CONNECTION:
          return vscode.window.showInformationMessage(INF_CONN_WORKING);
        case TEST_REST_WORKSPACES:
          return vscode.window.showInformationMessage(INF_GET_REST_WORKSPACES);
        case REST_WORKSPACES:
          const workspaces = [];
          for (const { Name } of response?.data?.items || []) {
            workspaces.push(Name);
          }
          return workspaces;
      }
    } catch (err: any) {
      let errorMessage = `Error using the Siebel REST API: ${
        err.response?.data?.ERROR ||
        err.message ||
        "check the state of the Siebel server!"
      }`;
      if (err.response?.status === 404) {
        switch (action) {
          case TEST_REST_WORKSPACES:
            errorMessage = ERR_NO_BASE_WS_IOB;
            break;
          case REST_WORKSPACES:
            errorMessage = ERR_NO_EDITABLE_WS;
            break;
        }
      }
      vscode.window.showErrorMessage(errorMessage);
      return [];
    }
  }

  static pushOrPull(action: ButtonAction) {
    return async () => {
      const document = vscode.window.activeTextEditor!.document,
        fileUri = document.uri,
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
      const answer = await vscode.window.showInformationMessage(
        `Do you want to ${action} the ${fileName} ${
          isWebTemp
            ? `web template definition`
            : `script of the ${parentName} ${siebelObjects[type].parent}`
        } ${
          action === PULL ? "from" : "to"
        } the ${workspace} workspace of the ${connectionName} connection?`,
        action === PULL ? "Pull" : "Push",
        "No"
      );
      if (answer !== "Pull" && answer !== "Push") return;
      const { url, username, password } = connection,
        resourceUrl = this.joinUrl(
          url,
          WORKSPACE,
          workspace,
          siebelObjects[type].parent,
          isWebTemp
            ? fileName
            : this.joinUrl(
                parentName,
                siebelObjects[type as NotWebTemp].child,
                fileName
              )
        );
      switch (action) {
        case PULL:
          const content = await this.callRestApi(
            PULL,
            resourceUrl,
            username,
            password,
            field
          );
          if (!content || content.length === 0) return;
          return await this.writeFile(fileUri, content);
        case PUSH:
          await document.save();
          const text = document.getText(),
            payload: Payload = { Name: fileName, [field]: text };
          if (!isWebTemp) {
            const sameName = new RegExp(`function\\s+${fileName}\\s*\\(`).test(
              text
            );
            if (!sameName && fileName !== "(declarations)")
              return vscode.window.showErrorMessage(ERR_NAME_DIFF);
            payload["Program Language"] = "JS";
          }
          return await this.callRestApi(
            PUSH,
            resourceUrl,
            username,
            password,
            payload
          );
      }
    };
  }

  static async createIndexdtsAndJSConfigjson(contextUri: vscode.Uri) {
    try {
      const workspaceUri = vscode.workspace.workspaceFolders![0].uri,
        typeDefUri = this.joinUri(workspaceUri, FILE_NAME_TYPE_DEF),
        jsconfigUri = this.joinUri(workspaceUri, FILE_NAME_JSCONFIG);
      if (!(await this.resourceExists(typeDefUri))) {
        const siebelTypesUri = this.joinUri(contextUri, FILE_NAME_SIEBEL_TYPES);
        await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
        vscode.window.showInformationMessage(
          `File index.d.ts was created in ${workspaceUri} folder!`
        );
      }
      if (await this.resourceExists(jsconfigUri)) return;
      await this.writeFile(jsconfigUri, JS_CONFIG);
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${workspaceUri} folder!`
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }
}
