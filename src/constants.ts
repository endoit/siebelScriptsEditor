//Siebel object names
export const SERVICE = "service";
export const BUSCOMP = "buscomp";
export const APPLET = "applet";
export const APPLICATION = "application";
export const WEBTEMP = "webtemp";

//Resource URLs
export const RESOURCE_URL = {
  [SERVICE]: { obj: "Business Service", scr: "Business Service Server Script" },
  [BUSCOMP]: { obj: "Business Component", scr: "BusComp Server Script" },
  [APPLET]: { obj: "Applet", scr: "Applet Server Script" },
  [APPLICATION]: { obj: "Application", scr: "Application Server Script" },
  [WEBTEMP]: { obj: "Web Template", scr: "" },
} as const;

//Webview commands
export const SELECT_CONNECTION = "selectConnection";
export const SELECT_WORKSPACE = "selectWorkspace";
export const SELECT_OBJECT = "selectObject";
export const SEARCH = "search";
export const SET_DEFAULT = "setDefault";
export const OPEN_CONFIG = "openConfig";

//REST methods
export const GET = "get";
export const PUT = "put";

//Button actions
export const PUSH = "push";
export const PULL = "pull";

//Constants for the extension
export const ONLY_METHOD_NAMES = true;

//Constant error messages
export const ERR_NO_WS_OPEN =
  "Please open a Visual Studio Code workspace folder to use the extension!";
export const ERR_NO_CONN_SETTING = "Please add at least one connection in the Connections setting!";
export const ERR_CONN_PARAM_PARSE =
  "Error parsing the connection parameters, please check format of Connections settings!";
export const ERR_NO_WS_CONN = "No workspace was found for any connection, please check Connections setting!";
export const ERR_NO_INFO_JSON =
  "File info.json was not found, please get the Siebel Object again from the extension!";
export const ERR_NO_SCRIPT_INFO =
  "Script was not found in info.json, please get it again from the extension!";
export const ERR_NO_WEBTEMP_INFO =
  "Web template was not found in info.json, please get it again from the extension!";
export const ERR_NO_UPDATE =
  "Update was unsuccessful, check REST API connection!";
export const ERR_FILE_FUNCTION_NAME_DIFF =
  "Unable to create new method, name of the file and the function is not the same!";
