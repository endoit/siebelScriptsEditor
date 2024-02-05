//Siebel object names
export const SERVICE = "service";
export const BUSCOMP = "buscomp";
export const APPLET = "applet";
export const APPLICATION = "application";
export const WEBTEMP = "webtemp";

//Repository object urls
export const REPOSITORY_OBJECT = {
  [SERVICE]: {
    parent: "Business Service",
    child: "Business Service Server Script",
  },
  [BUSCOMP]: { parent: "Business Component", child: "BusComp Server Script" },
  [APPLET]: { parent: "Applet", child: "Applet Server Script" },
  [APPLICATION]: { parent: "Application", child: "Application Server Script" },
  [WEBTEMP]: { parent: "Web Template", child: "" },
} as const;

export const QUERY_PARAMS: QueryParams = {
  uniformresponse: "y",
  childLinks: "None",
  pageSize: 100,
} as const;

export const WORKSPACE_QUERY_PARAMS: QueryParams = {
  fields: "Name",
  workspace: "MAIN",
} as const;

//Webview commands
export const SEARCH = "search";
export const OPEN_CONFIG = "openConfig";

//REST methods
export const GET = "get";
export const PUT = "put";

//Button actions
export const PUSH = "push";
export const PULL = "pull";

//constant file names
export const FILE_NAME_INFO = "info.json";
export const FILE_NAME_TYPE_DEF = "index.d.ts";
export const FILE_NAME_JSCONFIG = "jsconfig.json";
export const FILE_NAME_SIEBEL_TYPES = "siebelTypes.txt";

//global state parameters
export const CONFIG_DATA = "configData";
export const CONNECTION = "connection";
export const WORKSPACE = "workspace";
export const OBJECT = "object";
export const INTERCEPTOR = "interceptor";
export const DEFAULT_SCRIPT_FETCHING = "defaultScriptFetching";
export const SINGLE_FILE_AUTODOWNLOAD = "singleFileAutoDownload";
export const LOCAL_FILE_EXTENSION = "localFileExtension";

//constant URLs
export const PATH_MAIN_INTEG_OBJ = "workspace/MAIN/Integration Object";
export const PATH_WORKSPACE_IOB = "data/Workspace/Repository Workspace";

//fields
export const NAME = "Name";
export const SCRIPT = "Script";
export const DEFINITION = "Definition";
export const NAMESCRIPT = "Name,Script";

//Constant error messages
export const ERR_NO_WS_OPEN =
  "Please open a Visual Studio Code workspace folder to use the extension!";
export const ERR_NO_CONN_SETTING =
  "Please add at least one connection in the Connections setting!";
export const ERR_CONN_PARAM_PARSE =
  "Error parsing the connection parameters, please check format of Connections settings!";
export const ERR_NO_WS_CONN =
  "No workspace was found for any connection, please check Connections setting!";
export const ERR_NO_INFO_JSON =
  "File info.json was not found, please get the Siebel Object again from the extension!";
export const ERR_NO_INFO_JSON_ENTRY =
  "Script/web template was not found in info.json, please get it again from the extension!";
export const ERR_NO_UPDATE =
  "Update was unsuccessful, check REST API connection!";
export const ERR_FILE_FUNCTION_NAME_DIFF =
  "Unable to create new method, name of the file and the function is not the same!";
