//Siebel object names
export const SERVICE = "service",
  BUSCOMP = "buscomp",
  APPLET = "applet",
  APPLICATION = "application",
  WEBTEMP = "webtemp";

//Repository object urls
export const repositoryObjects = {
  [SERVICE]: {
    parent: "Business Service",
    child: "Business Service Server Script",
  },
  [BUSCOMP]: { parent: "Business Component", child: "BusComp Server Script" },
  [APPLET]: { parent: "Applet", child: "Applet Server Script" },
  [APPLICATION]: { parent: "Application", child: "Application Server Script" },
  [WEBTEMP]: { parent: "Web Template" },
} as const;

//query params
export const baseQueryParams = {
  uniformresponse: "y",
  childlinks: "None",
} as const;

export const workspaceQueryParams = {
  fields: "Name",
  workspace: "MAIN",
} as const;

//webview commands
export const SEARCH = "search",
  NEW_CONNECTION = "newConnection",
  DELETE_CONNECTION = "deleteConnection",
  ADD = "add",
  DEFAULT = "default",
  DELETE = "delete",
  TEST_CONNECTION = "testConnection",
  CREATE_OR_UPDATE_CONNECTION = "createOrUpdateConnection";

//REST methods
export const GET = "get",
  PUT = "put";

//button actions
export const PUSH = "push",
  PULL = "pull";

//constant file names
export const FILE_NAME_INFO = "info.json",
  FILE_NAME_TYPE_DEF = "index.d.ts",
  FILE_NAME_JSCONFIG = "jsconfig.json",
  FILE_NAME_SIEBEL_TYPES = "siebelTypes.txt";

//setting names
export const CONNECTIONS = "connections",
  DEFAULT_CONNECTION_NAME = "defaultConnectionName",
  DEFAULT_SCRIPT_FETCHING = "defaultScriptFetching",
  SINGLE_FILE_AUTODOWNLOAD = "singleFileAutoDownload",
  LOCAL_FILE_EXTENSION = "localFileExtension",
  MAX_PAGE_SIZE = "maxPageSize";

//global state parameters
export const CONNECTION = "connection",
  WORKSPACE = "workspace",
  WORKSPACE_FOLDER = "workspaceFolder",
  OBJECT = "object",
  INTERCEPTOR = "interceptor",
  REST_WORKSPACES = "restWorkspaces";

//constant URLs
export const PATH_TO_APPLICATION = "workspace/MAIN/Application",
  PATH_MAIN_INTEG_OBJ = "workspace/MAIN/Integration Object",
  PATH_WORKSPACE_IOB = "data/Workspace/Repository Workspace";

//fields
export const NAME = "Name",
  SCRIPT = "Script",
  DEFINITION = "Definition",
  NAMESCRIPT = "Name,Script";

//info object keys for timestamps
export const INFO_KEY_LAST_UPDATE = "last update from Siebel",
  INFO_KEY_LAST_PUSH = "last push to Siebel",
  INFO_KEY_FOLDER_CREATED = "folder created at";

//Booleans
export const IS_NEW_CONNECTION = true,
  OPEN_FILE = true;

//Constant error messages
export const ERR_NO_WS_OPEN =
    "Please open a Visual Studio Code workspace folder to use the extension!",
  ERR_NO_CONN_SETTING =
    "Please add create least one connection with the New Connection button!",
  ERR_CONN_MISSING_PARAMS =
    "Missing Connection Name/Siebel REST API Base URI/Username/Password, please check the connection configuration!",
    ERR_NO_BASE_WS_IOB = "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing!",
  ERR_NO_WS_CONN =
    "No workspace was found for any connection, please check Connections setting!",
  ERR_NO_INFO_JSON =
    "File info.json was not found, please get the Siebel Object again from the extension!",
  ERR_NO_INFO_JSON_ENTRY =
    "Script/web template was not found in info.json, please get it again from the extension!",
  ERR_NO_UPDATE = "Update was unsuccessful, check REST API connection!",
  ERR_FILE_FUNCTION_NAME_DIFF =
    "Unable to create new method, name of the file and the function is not the same!";
