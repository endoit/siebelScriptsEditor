//Siebel object short names
export const SERVICE = "service";
export const BUSCOMP = "buscomp";
export const APPLET = "applet";
export const APPLICATION = "application";
export const WEBTEMP = "webtemp";

//Siebel object long names
export const SERVICE_LONG = "Business Service";
export const BUSCOMP_LONG = "Business Component";
export const APPLET_LONG = "Applet";
export const APPLICATION_LONG = "Application";
export const WEBTEMP_LONG = "Web Template";

//Webview commands
export const SELECT_CONNECTION = "selectConnection";
export const SELECT_WORKSPACE = "selectWorkspace";
export const SELECT_OBJECT = "selectObject";
export const SEARCH = "search";
export const SET_DEFAULT = "setDefault";
export const OPEN_CONFIG = "openConfig";
export const RELOAD = "reload";
export const TEST_REST = "testREST";

//REST methods
export const GET = "get";
export const PUT = "put";

//Button actions
export const PUSH = "push";
export const PULL = "pull";

//Constants for the extension
export const NO_REST_CONFIG = true;
export const RELOAD_ENABLED = true;
export const IS_WEBTEMPLATE = true;
export const ONLY_METHOD_NAMES = true;
export const ERROR = "Error";

//Constant error messages
export const ERR_NO_WS_OPEN = "Please open a Visual Studio Code workspace folder to use the extension!";
export const ERR_CONN_PARAM_PARSE = "Error parsing the connection parameters, please check format of the REST Endpoint Configurations and the Workspaces settings, then reload the extension!";
export const ERR_CONN_PARAM_FORMAT = "Check the format of the REST Endpoint Configurations and the Workspaces settings!";
export const ERR_CONN_ERROR = "Connection error, please check connection parameters and Siebel server status!";
export const ERR_NO_CONFIG = "Please add at least one REST Endpoint configuration and workspace for that configuration!";
export const ERR_NO_EDITABLE_WS = "No workspace with status Checkpointed or Edit-In-Progress was found for any connection with the given username or the Base Workspace integration object is missing or was not merged into the primary branch in Siebel!";
export const ERR_NO_INFO_JSON = "File info.json was not found, please get the Siebel Object again from the extension!";
export const ERR_NO_SCRIPT_INFO = "Script was not found in info.json, please get it again from the extension!";
export const ERR_NO_WEBTEMP_INFO = "Web template was not found in info.json, please get it again from the extension!";
export const ERR_NO_UPDATE = "Update was unsuccessful, check REST API connection!";
export const ERR_FILE_FUNCTION_NAME_DIFF = "Unable to create new method, name of the file and the function is not the same!";