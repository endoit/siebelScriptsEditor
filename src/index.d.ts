//Siebel object urls
type SiebelObjectUrls = {
  service: {
    parent: "Business Service";
    child: "Business Service Server Script";
  };
  buscomp: { parent: "Business Component"; child: "BusComp Server Script" };
  applet: { parent: "Applet"; child: "Applet Server Script" };
  application: { parent: "Application"; child: "Application Server Script" };
  webtemp: { parent: "Web Template"; child: "" };
};

//Siebel object types
type Type = keyof SiebelObjectUrls;

//Url parts for the Siebel objects
type UrlParts = SiebelObjectUrls[Type];

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

//Data field
type Field = "Script" | "Definition";

//Query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: "Name" | Field | `Name,${Field}`;
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
type ConfigMessage = {
  command:
    | "newConnection"
      | "editConnection"
    | "testConnection"
    | "workspace"
    | "testRestWorkspaces"
    | "deleteConnection";
  action: "add" | "default" | "delete";
  name: Config["name"];
  workspace: Config["workspaces"][number];
  isDefaultConnection: boolean;
  url: Config["url"];
  username: Config["username"];
  password: Config["password"];
  restWorkspaces: Config["restWorkspaces"];
};

//Config webview type
type WebviewType = "new" | "edit";

//Button actions
type ButtonAction = "push" | "pull";

//Siebel rest api action
type RestAction =
  | "testConnection"
  | "testRestWorkspaces"
  | "restWorkspaces"
  | ButtonAction;

//On disk map for files
type OnDisk = Map<string, ".js" | ".ts" | ".html">;

//Answer options for tree item selection
type AnswerOptions =
  | readonly ["Yes", "No"]
  | readonly ["Yes", "Only method names", "No"];

type AnswerWhenTrue = "Yes" | ExtensionSettings["defaultScriptFetching"];

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

//file extensions
type FileExt = ".js" | ".ts" | ".html"