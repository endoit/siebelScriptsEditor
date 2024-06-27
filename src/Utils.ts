import * as vscode from "vscode";
import {
  DEFINITION,
  GET,
  PULL,
  PUSH,
  PUT,
  REST_WORKSPACES,
  SCRIPT,
  WORKSPACE,
  entity,
  withCredentials,
  queryParams,
  error,
  success,
} from "./constants";
import { Settings } from "./Settings";
import axios from "axios";

export class Utils {
  private static readonly restApi = axios.create({
    withCredentials,
  });

  static joinUrl(...args: string[]) {
    return args.join("/");
  }

  static joinUri(base: vscode.Uri, ...args: string[]) {
    return vscode.Uri.joinPath(base, ...args);
  }

  static async exists(resourceUri: vscode.Uri) {
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

  static async callRestApi(action: RestAction, request: RequestConfig) {
    try {
      const response = await this.restApi(request);
      if (success[action])
        vscode.window.showInformationMessage(success[action]);
      switch (action) {
        case PULL:
          return response.data?.items?.[0];
        case REST_WORKSPACES:
          const workspaces = [];
          for (const { Name } of response.data?.items?.[0] || []) {
            workspaces.push(Name);
          }
          return workspaces;
        default:
          return;
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `${error[action]} ${err.response?.data?.ERROR || err.message}.`
      );
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
            : `script of the ${parentName} ${entity[type].parent}`
        } ${
          action === PULL ? "from" : "to"
        } the ${workspace} workspace of the ${connectionName} connection?`,
        action === PULL ? "Pull" : "Push",
        "No"
      );
      if (answer !== "Pull" && answer !== "Push") return;
      const { url, username, password } = connection,
        request: RequestConfig = {
          method: GET,
          url: this.joinUrl(
            url,
            WORKSPACE,
            workspace,
            entity[type].parent,
            isWebTemp
              ? fileName
              : this.joinUrl(parentName, entity[type].child, fileName)
          ),
          auth: { username, password },
        };
      switch (action) {
        case PULL:
          request.params = queryParams[PULL][field];
          const response = await this.callRestApi(PULL, request),
            content = response?.[field];
          if (!content) return;
          return await this.writeFile(fileUri, content);
        case PUSH:
          await document.save();
          const text = document.getText();
          request.method = PUT;
          request.data = { Name: fileName, [field]: text };
          if (!isWebTemp) {
            const sameName = new RegExp(`function\\s+${fileName}\\s*\\(`).test(
              text
            );
            if (!sameName && fileName !== "(declarations)")
              return vscode.window.showErrorMessage(error.nameDifferent);
            request.data["Program Language"] = "JS";
          }
          return await this.callRestApi(PUSH, request);
      }
    };
  }

  static async setupWorkspaceFolder(contextUri: vscode.Uri) {
    try {
      const workspaceUri = vscode.workspace.workspaceFolders![0].uri,
        typeDefUri = this.joinUri(workspaceUri, "index.d.ts"),
        jsconfigUri = this.joinUri(workspaceUri, "jsconfig.json");
      if (!(await this.exists(typeDefUri))) {
        const siebelTypesUri = this.joinUri(contextUri, "siebelTypes.txt");
        await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
        vscode.window.showInformationMessage(
          `File index.d.ts was created in ${workspaceUri} folder!`
        );
      }
      if (await this.exists(jsconfigUri)) return;
      await this.writeFile(
        jsconfigUri,
        '{\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true\n  }\n}'
      );
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in ${workspaceUri} folder!`
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }
}
