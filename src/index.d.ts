//Siebel object types
type SiebelObject =
  | "service"
  | "buscomp"
  | "applet"
  | "application"
  | "webtemp";

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
  pageSize?: number;
  fields?: string;
  childLinks?: string;
  uniformresponse?: string;
  searchSpec?: string;
  workspace?: string;
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
  scripts: Record<string, UpdatePushDate>;
};

//info.json as object for web templates
type WebTempInfo = InfoObjectBase & {
  definitions: Record<string, UpdatePushDate>;
};

//date fields in the info.json
type UpdatePushDate = {
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
  connectionName?: string;
  workspace?: string;
  object?: SiebelObject;
  searchString?: string;
};

type MessageCommand =
  | "selectConnection"
  | "selectWorkspace"
  | "selectObject"
  | "search"
  | "setDefault"
  | "openConfig"
  | "reload"
  | "testREST";

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
type BasicSettings = {
  "REST EndpointConfigurations": string[];
  workspaces: string[];
  getWorkspacesFromREST: boolean;
  defaultConnection: string;
}

//Extended settings
type ExtendedSettings = {
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
