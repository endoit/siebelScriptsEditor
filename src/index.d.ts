//Siebel object types
type Type = "service" | "buscomp" | "applet" | "application" | "webtemp";

//settings
/*type ExtensionSettings = {
  connections: Config[];
  fileExtension: "js" | "ts";
  maxPageSize: 10 | 20 | 50 | 100 | 200 | 500;
};*/

type RestConfig = {
  url: string;
  username: string;
  password: string;
  fileExtension: "js" | "ts";
  maxPageSize: 10 | 20 | 50 | 100 | 200 | 500;
};

type Config = {
  name: string;
  isDefault: boolean;
  restWorkspaces: boolean;
} & RestConfig;

//rest data field
type Field = "Script" | "Definition";

//query parameters
type QueryParams = {
  searchSpec?: string;
  workspace?: "MAIN";
  fields?: "Name" | `Name,${Field}` | "Name,Status";
  PageSize?: Config["maxPageSize"];
};

//body when upserting script/web template into Siebel
type Payload = {
  Name: string;
  Script?: string;
  "Program Language"?: "JS";
  Definition?: string;
  "Project Name"?: string;
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

type ConfigMessage = {
  command:
    | "testRestWorkspaces"
    | "testConnection"
    | "newConnection"
    | "editConnection"
    | "deleteConnection";
} & Config;

//Siebel rest api actions
type RestAction =
  | "search"
  | "testConnection"
  | "allWorkspaces"
  | "editableWorkspaces"
  | "pullScript"
  | "pullScripts"
  | "pullDefinition"
  | "compareScript"
  | "compareDefinition";

//file extensions
type FileExt = "js" | "ts" | "html";

//downloaded files
type OnDisk = Map<string, FileExt>;

//button visibility object
type ButtonVisibility = {
  push: boolean;
  pushAll: boolean;
  search: boolean;
  compare: boolean;
  treeEdit: boolean;
};

//type for subscriptions
type Subscriptions = { dispose(): any }[];
