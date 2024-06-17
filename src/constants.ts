//Siebel object names
export const  SECTION = "siebelScriptAndWebTempEditor",
  SERVICE = "service",
  BUSCOMP = "buscomp",
  APPLET = "applet",
  APPLICATION = "application",
  WEBTEMP = "webtemp",
  //Repository object urls
  repositoryObjects = {
    [SERVICE]: {
      parent: "Business Service",
      child: "Business Service Server Script",
    },
    [BUSCOMP]: { parent: "Business Component", child: "BusComp Server Script" },
    [APPLET]: { parent: "Applet", child: "Applet Server Script" },
    [APPLICATION]: {
      parent: "Application",
      child: "Application Server Script",
    },
    [WEBTEMP]: { parent: "Web Template" },
  } as const,
  //request headers
  CONTENT_TYPE = "Content-Type",
  APPLICATION_JSON = "application/json",
  headers = {
    [CONTENT_TYPE]: APPLICATION_JSON,
  } as const,
  //request query parameters
  uniformresponse = "y",
  childlinks = "None",
  MAIN = "MAIN",
  //webview commands
  TEST_CONNECTION = "testConnection",
  NEW_OR_EDIT_CONNECTION = "newOrEditConnection",
  ADD = "add",
  DEFAULT = "default",
  DELETE = "delete",
  TEST_REST_WORKSPACES = "testRestWorkspaces",
  REST_WORKSPACES = "restWorkspaces",
  DELETE_CONNECTION = "deleteConnection",
  CONNECTION = "connection",
  WORKSPACE = "workspace",
  TYPE = "type",
  SEARCH = "search",
  //REST methods
  GET = "get",
  PUT = "put",
  //button actions
  PUSH = "push",
  PULL = "pull",
  //setting names
  CONNECTIONS = "connections",
  DEFAULT_CONNECTION_NAME = "defaultConnectionName",
  DEFAULT_SCRIPT_FETCHING = "defaultScriptFetching",
  SINGLE_FILE_AUTODOWNLOAD = "singleFileAutoDownload",
  LOCAL_FILE_EXTENSION = "localFileExtension",
  MAX_PAGE_SIZE = "maxPageSize",
  //Deprecated setting names
  DEP_REST_ENDPOINT_CONFIGURATIONS = "REST EndpointConfigurations",
  DEP_WORKSPACES = "workspaces",
  DEP_DEFAULT_CONNECTION = "defaultConnection",
  DEP_GET_WORKSPACES_FROM_REST = "getWorkspacesFromREST",
  //constant URLs
  PATH_MAIN_IOB = "workspace/MAIN/Integration Object",
  PATH_WORKSPACE_IOB = "data/Workspace/Repository Workspace",
  //json fields
  NAME = "Name",
  SCRIPT = "Script",
  DEFINITION = "Definition",
  NAMESCRIPT = "Name,Script",
  //booleans
  IS_NEW_CONNECTION = true,
  OPEN_FILE = true,
  //constant file names
  FILE_NAME_TYPE_DEF = "index.d.ts",
  FILE_NAME_JSCONFIG = "jsconfig.json",
  FILE_NAME_SIEBEL_TYPES = "siebelTypes.txt",
  FILE_CHECKMARK_LIGHT = "checkmark_light.png",
  FILE_CHECKMARK_DARK = "checkmark_dark.png",
  MEDIA = "media",
  //constant information and error messages messages
  INF_CONN_WORKING = "Connection is working!",
  INF_GET_REST_WORKSPACES =
    "Getting workspaces from the Siebel REST API was successful!",
  ERR_NO_WS_OPEN =
    "Please open a Visual Studio Code workspace folder to use the extension!",
  ERR_NO_CONN_SETTING =
    "Please add create least one connection with the New Connection button!",
  ERR_CONN_MISSING_PARAMS =
    "Missing Connection Name/Siebel REST API Base URI/Username/Password, please check the connection configuration!",
  ERR_NO_BASE_WS_IOB =
    "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing or check the REST API connection!",
  ERR_NO_EDITABLE_WS =
    "No workspace with status Checkpointed or Edit-In-Progress was found!",
  ERR_NO_UPDATE = "Update was unsuccessful, check the REST API connection!",
  ERR_FILE_FUNCTION_NAME_DIFF =
    "Unable to create new method, name of the file and the function is not the same!";
