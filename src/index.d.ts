//Siebel object types
type Type = "service" | "buscomp" | "applet" | "application" | "webtemp";

//settings
type ExtensionSettings = {
  connections: Config[];
  fileExtension: "js" | "ts";
  maxPageSize: 10 | 20 | 50 | 100 | 200 | 500;
};

type RestConfig = { url: string; username: string; password: string };

type Config = {
  name: string;
  isDefault: boolean;
  restWorkspaces: boolean;
} & RestConfig;

//rest data field
type Field = "Script" | "Definition";

//query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: "Name" | `Name,${Field}` | "Name,Status";
  PageSize?: ExtensionSettings["maxPageSize"];
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
  name: string;
  isDefault: boolean;
  restWorkspaces: boolean;
} & RestConfig;

//Siebel rest api actions
type RestAction =
  | "testConnection"
  | "allWorkspaces"
  | "editableWorkspaces"
  | "pullScript"
  | "pullDefinition"
  | "compareScript"
  | "compareDefinition";

//file extensions
type FileExt = "js" | "ts" | "html";

//downloaded files
type OnDisk = Map<string, FileExt>;

//tree item state
type TreeItemState = "disk" | "siebel" | "same" | "differ";

//Answer options for tree item selection
type Answer = "Only method names" | "All scripts" | "Yes" | "No" | undefined;

//button actions
type Button = "pull" | "push" | "search" | "pushAll";

//type for subscriptions
type Subscriptions = { dispose(): any }[];
