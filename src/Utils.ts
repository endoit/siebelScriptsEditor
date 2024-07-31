import * as vscode from "vscode";
import { entity, query, error, success } from "./constants";
import { Settings } from "./Settings";
import axios from "axios";

export class Utils {
  private static readonly restApi = axios.create({
    withCredentials: true,
  });

  static async callRestApi(
    action: RestAction,
    request: RequestConfig
  ): Promise<RestResponse[]> {
    try {
      const response = await this.restApi(request);
      if (success[action])
        vscode.window.showInformationMessage(success[action]);
      return response?.data?.items || [];
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `${error[action]} ${err.response?.data?.ERROR || err.message}.`
      );
      return [];
    }
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

  static pushOrPull(action: ButtonAction) {
    const isPull = action === "pull",
      [fromTo, options, method] = isPull
        ? (["from", ["Pull", "No"], "get"] as const)
        : (["to", ["Push", "No"], "put"] as const);
    return async () => {
      const document = vscode.window.activeTextEditor!.document,
        uriParts = document.uri.path.split("/"),
        [name, ext] = uriParts.at(-1)!.split("."),
        isScript = ext !== "html",
        [connectionName, workspace, type, parentName] = uriParts.slice(
          isScript ? -5 : -4,
          -1
        ),
        { parent, child } = entity[<SiebelObject>type],
        [field, message, path] = isScript
          ? ([
              "Script",
              `script of the ${parentName} ${parent}`,
              [parentName, child, name].join("/"),
            ] as const)
          : (["Definition", "web template definition", name] as const),
        connection = Settings.getConnection(connectionName);
      if (!connection.name)
        return vscode.window.showErrorMessage(
          `Connection "${connectionName}" was not found in the Connections settings!`
        );
      const answer = await vscode.window.showInformationMessage(
        `Do you want to ${action} the ${name} ${message} ${fromTo} the ${workspace} workspace of the ${connectionName} connection?`,
        ...options
      );
      if (answer !== "Pull" && answer !== "Push") return;
      const { url, username, password } = connection,
        request: RequestConfig = {
          method,
          url: [url, "workspace", workspace, parent, path].join("/"),
          auth: { username, password },
        };
      if (isPull) {
        request.params = query.pull[field];
        const response = await this.callRestApi("pull", request),
          text = response[0]?.[field];
        if (!text) return;
        return await this.writeFile(document.uri, text);
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
      await this.callRestApi("push", request);
    };
  }

  static async setupWorkspaceFolder({ extensionUri }: vscode.ExtensionContext) {
    try {
      const workspaceUri = vscode.workspace.workspaceFolders![0].uri,
        typeDefUri = vscode.Uri.joinPath(workspaceUri, "index.d.ts"),
        jsconfigUri = vscode.Uri.joinPath(workspaceUri, "jsconfig.json"),
        siebelTypesUri = vscode.Uri.joinPath(extensionUri, "siebelTypes.txt");
      if (!(await this.exists(typeDefUri))) {
        await vscode.workspace.fs.copy(siebelTypesUri, typeDefUri);
        vscode.window.showInformationMessage(
          `File index.d.ts was created in the ${workspaceUri.fsPath} folder!`
        );
      }
      if (await this.exists(jsconfigUri)) return;
      await this.writeFile(
        jsconfigUri,
        `{\n  "compilerOptions": {\n    "allowJs": true,\n    "checkJs": true\n  }\n}`
      );
      vscode.window.showInformationMessage(
        `File jsconfig.json was created in the ${workspaceUri.fsPath} folder!`
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  }
}
