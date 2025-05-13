//Siebel object types
type Type = "service" | "buscomp" | "applet" | "application" | "webtemp";

//Settings
type ExtensionSettings = {
  connections: Config[];
  defaultConnectionName: string;
  singleFileAutoDownload: boolean;
  localFileExtension: ".js" | ".ts";
  defaultScriptFetching:
    | "Only method names"
    | "All scripts"
    | "None - always ask";
  maxPageSize: 10 | 20 | 50 | 100 | 200 | 500;
  defaultActionWhenFileExists: "None - always ask" | "Open file" | "Overwrite";
};

type RestRequest = { username: string; password: string; url: string };

type Config = {
  name: string;
  workspaces: string[];
  defaultWorkspace: string;
  restWorkspaces: boolean;
} & RestRequest;

//Data field
type Field = "Script" | "Definition";

//Query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: "Name" | Field | `Name,${Field}` | "Name,Status";
  PageSize?: ExtensionSettings["maxPageSize"];
};

//body when upserting script/web template into Siebel
type Payload = {
  Name: string;
  Script?: string;
  "Program Language"?: "JS";
  Definition?: string;
};

//Siebel REST response
type RestResponse = {
  Name: string;
  Script?: string;
  Definition?: string;
  Status?: string;
  RepositoryWorkspace?: RestResponse;
}[];

//message received from the datasource webview
type DataSourceMessage =
  | {
      command: "connection" | "workspace" | "search";
      data: string;
    }
  | {
      command: "type";
      data: Type;
    };

//message received from the configuration webview
type WorkspaceAction = "add" | "default" | "delete";

type ConfigMessage = {
  command:
    | "workspace"
    | "testRestWorkspaces"
    | "testConnection"
    | "newConnection"
    | "editConnection"
    | "deleteConnection";
  action: WorkspaceAction;
  name: string;
  workspace: string;
  isDefaultConnection: boolean;
  restWorkspaces: boolean;
} & RestRequest;

//Siebel rest api action
type RestAction =
  | "testConnection"
  | "allWorkspaces"
  | "editableWorkspaces"
  | "push"
  | "pullScript"
  | "pullDefinition"
  | "compareScript"
  | "compareDefinition"
  | "treeData";


//file extensions
type FileExt = ".js" | ".ts" | ".html";
type FileExtNoDot = "js" | "ts" | "html";

//On disk map for files
type OnDisk = Map<string, FileExt>;

//Answer options for tree item selection
type Answer = "Only method names" | "All scripts" | "Yes" | "No" | undefined;

//Deprecated settings
type DeprecatedSettings = {
  "REST EndpointConfigurations"?: string[];
  workspaces?: string[];
  defaultConnection?: string;
  getWorkspacesFromREST?: boolean;
};

//Union of all settings
type AllSettings = ExtensionSettings & DeprecatedSettings;

//type for subscriptions
type Subscriptions = { dispose(): any }[];
