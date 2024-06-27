//Siebel object names
export const SECTION = "siebelScriptAndWebTempEditor",
  SERVICE = "service",
  BUSCOMP = "buscomp",
  APPLET = "applet",
  APPLICATION = "application",
  WEBTEMP = "webtemp",
  //Repository object urls
  entity = {
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
    [WEBTEMP]: { parent: "Web Template", child: "" },
  } as const,
  //constant request parameters
  withCredentials = true,
  uniformresponse = "y",
  childlinks = "None",
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
  //json fields
  NAME = "Name",
  SCRIPT = "Script",
  DEFINITION = "Definition",
  NAMESCRIPT = "Name,Script",
  NAMEDEFINITION = "Name,Definition",
  //booleans
  NAMES_ONLY = true,
  IS_NEW_CONNECTION = true,
  OPEN_FILE = true,
  //constant query params
  queryParams = {
    [TEST_CONNECTION]: {
      fields: NAME,
      workspace: "MAIN",
      uniformresponse,
      childlinks,
    },
    [TEST_REST_WORKSPACES]: {
      fields: NAME,
      workspace: "MAIN",
      searchspec: "Name='Base Workspace'",
      uniformresponse,
      childlinks,
    },
    [REST_WORKSPACES]: {
      fields: NAME,
      workspace: "MAIN",
      searchspec: "Status='Checkpointed' OR Status='Edit-In-Progress'",
      uniformresponse,
      childlinks,
    },
    [PULL]: {
      [SCRIPT]: { uniformresponse, childlinks, fields: SCRIPT },
      [DEFINITION]: { uniformresponse, childlinks, fields: DEFINITION },
    },
  } as const,
  //constant urls
  constantPaths = {
    [TEST_CONNECTION]: "workspace/MAIN/Integration Object",
    [TEST_REST_WORKSPACES]: "workspace/MAIN/Integration Object",
    [REST_WORKSPACES]: "data/Workspace/Repository Workspace",
  } as const,
  //constant success and error messages messages
  success = {
    [PULL]: "",
    [PUSH]: "Successfully pushed object to Siebel!",
    [TEST_CONNECTION]: "Connection is working!",
    [TEST_REST_WORKSPACES]:
      "Getting workspaces from the Siebel REST API was successful!",
    [REST_WORKSPACES]: "",
  } as const,
  error = {
    [PULL]: "Error when pulling from Siebel:",
    [PUSH]: "Error when pushing to Siebel:",
    [TEST_CONNECTION]: "Error in the connection:",
    [TEST_REST_WORKSPACES]:
      "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing or check the REST API connection!",
    [REST_WORKSPACES]:
      "No workspace with status Checkpointed or Edit-In-Progress was found!",
    noWorkspaceFolder:
      "Please open a Visual Studio Code workspace folder to use the extension!",
    noConnection:
      "Please create at least one connection with the New Connection button!",
    missingParameters:
      "Missing Connection Name/Siebel REST API Base URI/Username/Password, please check the connection configuration!",
    noBaseWorkspaceIOB:
      "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing or check the REST API connection!",
    noEditableWorkspace:
      "No workspace with status Checkpointed or Edit-In-Progress was found!",
    nameDifferent:
      "Unable to create new method, name of the file and the function is not the same!",
  } as const;
