//Siebel object types
type SiebelObject =
  | "service"
  | "buscomp"
  | "applet"
  | "application"
  | "webtemp";

//Settings
type ExtensionSettings = {
  connections: Config[];
  defaultConnectionName: Config["name"];
  singleFileAutoDownload: boolean;
  localFileExtension: ".js" | ".ts";
  defaultScriptFetching:
    | "Only method names"
    | "All scripts"
    | "None - always ask";
  maxPageSize: 10 | 20 | 50 | 100 | 200 | 500;
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

//Fields
type Field = "Script" | "Definition";
type NameField = "Name,Script" | "Name,Definition";

//Query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: "Name" | Field | NameField;
  PageSize?: ExtensionSettings["maxPageSize"];
};

//body when upserting script/web template into Siebel
type Payload = {
  Name: string;
  Script?: string;
  "Program Language"?: "JS";
  Definition?: string;
};

//Request config object
type RequestConfig = {
  method: "get" | "put";
  url: Config["url"];
  auth: {
    username: Config["username"];
    password: Config["password"];
  };
  params?: QueryParams;
  data?: Payload;
};

//Siebel REST response
type RestResponse = {
  Name: string;
  Script?: string;
  Definition?: string;
};

//message sent to the datasource webview
type ExtensionStateMessage = {
  connections?: Config["name"][];
  connection?: Config["name"];
  workspaces?: Config["workspaces"];
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
  connectionName: Config["name"];
  workspace: string;
  defaultConnection: boolean;
  url: Config["url"];
  username: Config["username"];
  password: Config["password"];
  restWorkspaces: Config["restWorkspaces"];
};

//Button actions
type ButtonAction = "push" | "pull";

//Siebel rest api action
type RestAction =
  | "testConnection"
  | "testRestWorkspaces"
  | "restWorkspaces"
  | ButtonAction;

//TreeItemProperties
type TreeItemProperties = {
  message: string;
  path: string;
  condition: boolean;
  value: ExtensionSettings["defaultScriptFetching"] | "Yes";
  options: ("Yes" | "No" | "Only method names")[];
};

//Deprecated settings
type DeprecatedSettings = {
  "REST EndpointConfigurations"?: string[];
  workspaces?: string[];
  defaultConnection?: string;
  getWorkspacesFromREST?: boolean;
};

//Union of all settings
type AllSettings = ExtensionSettings & DeprecatedSettings;
