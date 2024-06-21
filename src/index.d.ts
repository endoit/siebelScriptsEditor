//Siebel object types
type SiebelObject =
  | "service"
  | "buscomp"
  | "applet"
  | "application"
  | "webtemp";

type NotWebTemp = Exclude<SiebelObject, "webtemp">;

//Settings
type ExtensionSettings = {
  connections: Config[];
  defaultConnectionName: string;
  singleFileAutoDownload: boolean;
  localFileExtension: ".js" | ".ts";
  defaultScriptFetching:
    | "Yes"
    | "No"
    | "Only method names"
    | "All scripts"
    | "None - always ask"
    | undefined;
  maxPageSize: number;
};

type Config = {
  name: string;
  username: string;
  password: string;
  url: string;
  workspaces: string[];
  defaultWorkspace: string;
  restWorkspaces: boolean;
};

//Data objects in the tree views
type ScriptObject = Record<string, OnDiskObject>;
type OnDiskObject = Record<string, boolean>;

//fields
type Fields = "Script" | "Definition";

//Query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: Fields | "Name" | "Name,Script";
  childlinks?: "None";
  uniformresponse?: "y";
  PageSize?: number;
};

//Response scripts from Siebel
type ScriptResponse = {
  Name: string;
  Script?: string;
};

//Response web templates from Siebel
type WebTempResponse = {
  Name: string;
  Definition?: string;
};

//payload when upserting script/web template into Siebel
type Payload = {
  Name: string;
  Script?: string;
  "Program Language"?: "JS";
  Definition?: string;
};

//message sent to the datasource webview
type ExtensionStateMessage = {
  connections?: string[];
  connection?: string;
  workspaces?: string[];
  workspace?: string;
  type?: SiebelObject;
};

//message received from the datasource webview
type DataSourceMessage = {
  command: "connection" | "workspace" | "type" | "search";
  data: string;
};

//message received from the configuration webview
type ConfigMessage = {
  command:
    | "newOrEditConnection"
    | "testConnection"
    | "workspace"
    | "testRestWorkspaces"
    | "deleteConnection";
  action: "add" | "default" | "delete";
  connectionName: string;
  workspace: string;
  defaultConnection: boolean;
  url: string;
  username: string;
  password: string;
  restWorkspaces: boolean;
};

//REST method
type RestMethod = "get" | "put";

//Button actions
type ButtonAction = "push" | "pull";

//Siebel rest api actions
type RestAction =
  | "testConnection"
  | "testRestWorkspaces"
  | "restWorkspaces"
  | ButtonAction;

type RequestConfig = {
  method: RestMethod;
  url: Config["url"];
  auth: {
    username: Config["username"];
    password: Config["password"];
  };
  params?: QueryParams;
  data?: Payload;
};

//Union of all settings
type AllSettings = ExtensionSettings & DeprecatedSettings;

//Deprecated settings
type DeprecatedSettings = {
  "REST EndpointConfigurations"?: string[];
  workspaces?: string[];
  defaultConnection?: string;
  getWorkspacesFromREST?: boolean;
};
