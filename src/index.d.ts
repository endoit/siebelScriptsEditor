//Siebel object types
type SiebelObject =
  | "service"
  | "buscomp"
  | "applet"
  | "application"
  | "webtemp";

type NotWebTemp = Exclude<SiebelObject, "webtemp">;

//Settings
type Settings = {
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

//Connection parameters
type Connection = Pick<Config, "url" | "username" | "password">;

//Data objects in the tree views
type ScriptObject = Record<string, Scripts>;
type Scripts = Record<string, boolean>;
type WebTempObject = Record<string, boolean>;

//Query parameters
type QueryParams = {
  searchspec?: string;
  workspace?: "MAIN";
  fields?: "Name" | "Script" | "Definition" | "Name,Script";
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

//message sent from the datasource webview
type DataSourceMessage = {
  command: "connection" | "workspace" | "type" | "search";
  data: string;
};

//message sent from the configuration webview
type ConfigMessage = {
  command:
    | "newOrEditConnection"
    | "testConnection"
    | "workspace"
    | "restWorkspaces"
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

//REST methods
type RestMethod = "get" | "put";

//Button actions
type ButtonAction = "push" | "pull";

//overloaded function interfaces
interface IAxiosInstance {
  (
    { url, username, password }: Connection,
    method: "get",
    paramsOrPayload: QueryParams
  ): Promise<any[]>;
  (
    { url, username, password }: Connection,
    method: "put",
    paramsOrPayload: Payload
  ): Promise<number>;
}

interface IGetDataFromSiebel {
  (url: string, fields: "Name", searchSpec: string): Promise<
    ScriptResponse[] | WebTempResponse[]
  >;
  (url: string, fields: "Name" | "Name,Script" | "Script"): Promise<
    ScriptResponse[]
  >;
  (url: string, fields: "Definition"): Promise<WebTempResponse[]>;
}

interface IGetSetting {
  (settingName: "connections"): Settings["connections"];
  (settingName: "defaultConnectionName"): Settings["defaultConnectionName"];
  (settingName: "singleFileAutoDownload"): Settings["singleFileAutoDownload"];
  (settingName: "localFileExtension"): Settings["localFileExtension"];
  (settingName: "defaultScriptFetching"): Settings["defaultScriptFetching"];
  (settingName: "maxPageSize"): Settings["maxPageSize"];
}

interface ISetSetting {
  (
    settingName: "connections",
    settingValue: Settings["connections"]
  ): Promise<void>;
  (
    settingName: "defaultConnectionName",
    settingValue: Settings["defaultConnectionName"]
  ): Promise<void>;
  (
    settingName:
      | "REST EndpointConfigurations"
      | "workspaces"
      | "defaultConnection"
      | "getWorkspacesFromREST",
    settingValue: undefined
  ): Promise<void>;
}
