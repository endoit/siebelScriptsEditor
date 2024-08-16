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
  defaultActionWhenFileExists: "None - always ask" | "Open file" | "Overwrite";
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
type NameField = "Name,Script" | "Name,Definition";

//Query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: "Name" | "Script" | "Definition" | NameField;
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
  url: Config["url"];
  method?: "get" | "put";
  auth?: {
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

//message received from the datasource webview
type DataSourceMessage =
  | {
      command: "connection" | "workspace" | "search";
      data: string;
    }
  | {
      command: "type";
      data: SiebelObject;
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
  name: Config["name"];
  workspace: Config["workspaces"][number];
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

//TreeItemQuestion
type TreeItemQuestion = {
  message: string;
  condition: boolean;
  value: ExtensionSettings["defaultScriptFetching"] | "Yes";
  options: ("Yes" | "No" | "Only method names")[];
  url: string;
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
