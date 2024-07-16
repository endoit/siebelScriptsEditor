import * as vscode from "vscode";
import { entity, query, error, success } from "./constants";
import { Settings } from "./Settings";
import axios from "axios";

export class Utils {
  private static readonly restApi = axios.create({
    withCredentials: true,
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
      if (!openFile) return;
      await vscode.window.showTextDocument(fileUri, { preview: false });
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }

  static async callRestApi(
    action: RestAction,
    request: RequestConfig
  ): Promise<RestResponse[]> {
    try {
      const response = await this.restApi(request);
      if (success[action]) this.info(success[action]);
      return response?.data?.items || [];
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `${error[action]} ${err.response?.data?.ERROR || err.message}.`
      );
      return [];
    }
  }

  static pushOrPull(action: ButtonAction) {
    const isPull = action === "pull";
    return async () => {
      const document = vscode.window.activeTextEditor!.document,
        fileUri = document.uri,
        parts = fileUri.path.split("/"),
        [name, ext] = parts.at(-1)!.split("."),
        isScript = ext !== "html",
        [field, offset]: [DataField, number] = isScript
          ? ["Script", -5]
          : ["Definition", -4],
        [connectionName, workspace, type, parentName] = parts.slice(offset, -1),
        connection = Settings.getConnection(connectionName);
      if (!connection.name)
        return vscode.window.showErrorMessage(
          `Connection "${connectionName}" was not found in the Connections settings!`
        );
      const { parent, child } = entity[type as SiebelObject],
        question = `Do you want to ${action} the ${name} ${
          isScript
            ? `script of the ${parentName} ${parent}`
            : `web template definition`
        } ${
          isPull ? "from" : "to"
        } the ${workspace} workspace of the ${connectionName} connection?`,
        answer = await this.info(question, isPull ? "Pull" : "Push", "No");
      if (answer !== "Pull" && answer !== "Push") return;
      const { url, username, password } = connection,
        request: RequestConfig = {
          method: isPull ? "get" : "put",
          url: this.joinUrl(
            url,
            "workspace",
            workspace,
            parent,
            isScript ? this.joinUrl(parentName, child, name) : name
          ),
          auth: { username, password },
        };
      if (isPull) {
        request.params = query.pull[field];
        const response = await this.callRestApi("pull", request),
          text = response[0]?.[field];
        if (!text) return;
        return await this.writeFile(fileUri, text);
      }
      await document.save();
      const text = document.getText();
      request.data = { Name: name, [field]: text };
      if (isScript) {
        const sameName = new RegExp(`function\\s+${name}\\s*\\(`).test(text);
        if (!sameName && name !== "(declarations)")
          return vscode.window.showErrorMessage(error.nameDifferent);
        request.data["Program Language"] = "JS";
      }
      return await this.callRestApi("push", request);
    };
  }

  static async info(message: string, ...answers: string[]) {
    return await vscode.window.showInformationMessage(message, ...answers);
  }

  static async setupWorkspaceFolder(contextUri: vscode.Uri) {
    try {
      const workspaceUri = vscode.workspace.workspaceFolders![0].uri,
        fsPath = workspaceUri.fsPath,
        typeDefUri = this.joinUri(workspaceUri, "index.d.ts"),
        jsconfigUri = this.joinUri(workspaceUri, "jsconfig.json");
      if (!(await this.exists(typeDefUri))) {
        const siebelTypesUri = this.joinUri(contextUri, "siebelTypes.txt");
        await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
        this.info(`File index.d.ts was created in the ${fsPath} folder!`);
      }
      if (await this.exists(jsconfigUri)) return;
      await this.writeFile(
        jsconfigUri,
        `{\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true\n  }\n}`
      );
      this.info(`File jsconfig.json was created in the ${fsPath} folder!`);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }
}
