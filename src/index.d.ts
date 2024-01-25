//Siebel object types
type SiebelObject = ObjectWithScript | ObjectWithDefinition;

type ObjectWithScript = "service" | "buscomp" | "applet" | "application";

type ObjectWithDefinition = "webtemp";

//Connections object
type Connections = Record<
  string,
  Connection & {
    workspaces: string[];
  }
>;

type Connection = {
  username: string;
  password: string;
  url: string;
};

//Workspaces object
type Workspaces = Record<string, string[]>;

//Selected object
type Selected = {
  connection: string;
  workspace: string;
  object: SiebelObject;
  service: SelectedScript;
  buscomp: SelectedScript;
  applet: SelectedScript;
  application: SelectedScript;
  webtemp: SelectedWebTemp;
};

type SelectedScript = { name: string; childName: string };
type SelectedWebTemp = { name: string };

//Data objects
type ScriptObject = Record<
  string,
  {
    onDisk: boolean;
    scripts: Scripts;
  }
>;

type Scripts = Record<string, Script>;

type Script = {
  onDisk: boolean;
  script?: string;
};

type WebTempObject = Record<
  string,
  {
    onDisk: boolean;
    definition: string;
  }
>;

//Query parameters
type QueryParams = {
  searchSpec?: string;
  workspace?: string;
  fields: "Name" | "Script" | "Definition" | "Name,Script";
  pageSize?: 20 | 100;
  childLinks: "None";
  uniformresponse?: "y";
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

//info.json as an object
type InfoObjectBase = {
  "folder created at": string;
  connection: string;
  workspace: string;
  type: SiebelObject;
};

//info.json as object for scripts
type ScriptInfo = InfoObjectBase & {
  siebelObjectName: string;
  scripts: Record<string, PullPushDate>;
};

//info.json as object for web templates
type WebTempInfo = InfoObjectBase & {
  definitions: Record<string, PullPushDate>;
};

//date fields in the info.json
type PullPushDate = {
  "last update from Siebel": string;
  "last push to Siebel": string;
};

//payload when upserting script/web template into Siebel
type Payload = {
  Name: string;
  Script?: string;
  Definition?: string;
  "Program Language"?: "JS";
};

//message object sent from the webview
type Message = {
  command: MessageCommand;
  connectionName: string;
  workspace: string;
  object: SiebelObject;
  searchString: string;
};

type MessageCommand =
  | "selectConnection"
  | "selectWorkspace"
  | "selectObject"
  | "search"
  | "setDefault"
  | "openConfig";

//TreeItem object properties
type TreeItemProps = {
  onDisk: boolean;
  scripts?: Record<string, Script>;
  parent?: string;
  definition?: string;
};

//REST methods
type RestMethod = "get" | "put";

//Button actions
type ButtonAction = "push" | "pull";

//Basic settings
type Settings = {
  connections: Record<string, string>;
  defaultConnection: string;
  singleFileAutoDownload: boolean;
  localFileExtension: ".js" | ".ts";
  defaultScriptFetching:
    | "Yes"
    | "No"
    | "Only method names"
    | "All scripts"
    | "None - always ask"
    | undefined;
};

//interfaces for overloaded functions
interface OverloadedCallRESTAPIInstance {
  (
    { url, username, password }: Connection,
    method: "get",
    params: QueryParams
  ): Promise<any>;
  (
    { url, username, password }: Connection,
    method: "put",
    params: Payload
  ): Promise<any>;
}

//Deprecated settings
type OldSettings = {
  "REST EndpointConfigurations": string[];
  workspaces: string[];
  getWorkspacesFromREST: boolean;
};
