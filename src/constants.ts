import * as vscode from "vscode";
import { create } from "axios";

//workspace folder for the extension
export const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri!,
  //files for the compared objects
  compareFileUris =
    workspaceUri &&
    ({
      js: vscode.Uri.joinPath(workspaceUri, "compare", "compare.js"),
      ts: vscode.Uri.joinPath(workspaceUri, "compare", "compare.ts"),
      html: vscode.Uri.joinPath(workspaceUri, "compare", "compare.html"),
    } as const),
  //extension settings
  settings = [
    ...(<Config[]>(
      vscode.workspace
        .getConfiguration("siebelScriptAndWebTempEditor")
        .get("connections")!
    )),
  ],
  //rest api instance
  restApi = create({
    withCredentials: true,
    params: {
      uniformresponse: "y",
      childlinks: "None",
    },
  }),
  //Repository object paths and scripts
  metadata = {
    service: {
      parent: "Business Service",
      child: "Business Service Server Script",
      defaultScripts: [
        {
          label: "Service_PreInvokeMethod",
          scriptArgs: "MethodName, Inputs, Outputs",
          isPre: true,
        },
        {
          label: "Service_InvokeMethod",
          scriptArgs: "MethodName, Inputs, Outputs",
        },
        {
          label: "Service_PreCanInvokeMethod",
          scriptArgs: "MethodName, &CanInvoke",
          isPre: true,
        },
        { label: "(declarations)" },
      ],
    },
    buscomp: {
      parent: "Business Component",
      child: "BusComp Server Script",
      defaultScripts: [
        {
          label: "BusComp_PreSetFieldValue",
          scriptArgs: "FieldName, FieldValue",
          isPre: true,
        },
        { label: "BusComp_SetFieldValue", scriptArgs: "FieldName" },
        {
          label: "BusComp_PreGetFieldValue",
          scriptArgs: "FieldName, &FieldValue",
          isPre: true,
        },
        { label: "BusComp_PreCopyRecord", isPre: true },
        { label: "BusComp_CopyRecord" },
        { label: "BusComp_PreNewRecord", isPre: true },
        { label: "BusComp_NewRecord" },
        { label: "BusComp_PreAssociate", isPre: true },
        { label: "BusComp_Associate" },
        { label: "BusComp_PreDeleteRecord", isPre: true },
        { label: "BusComp_DeleteRecord" },
        { label: "BusComp_PreWriteRecord", isPre: true },
        { label: "BusComp_WriteRecord" },
        { label: "BusComp_ChangeRecord" },
        { label: "BusComp_PreQuery", isPre: true },
        { label: "BusComp_Query" },
        {
          label: "BusComp_PreInvokeMethod",
          scriptArgs: "MethodName",
          isPre: true,
        },
        { label: "BusComp_InvokeMethod", scriptArgs: "MethodName" },
        { label: "(declarations)" },
      ],
    },
    applet: {
      parent: "Applet",
      child: "Applet Server Script",
      defaultScripts: [
        {
          label: "WebApplet_PreInvokeMethod",
          scriptArgs: "MethodName",
          isPre: true,
        },
        { label: "WebApplet_InvokeMethod", scriptArgs: "MethodName" },
        {
          label: "WebApplet_ShowControl",
          scriptArgs: "ControlName, Property, Mode, &HTML",
        },
        {
          label: "WebApplet_ShowListColumn",
          scriptArgs: "ColumnName, Property, Mode, &HTML",
        },
        {
          label: "WebApplet_PreCanInvokeMethod",
          scriptArgs: "MethodName, &CanInvoke",
          isPre: true,
        },
        { label: "WebApplet_Load" },
        { label: "(declarations)" },
      ],
    },
    application: {
      parent: "Application",
      child: "Application Server Script",
      defaultScripts: [
        { label: "Application_Start", scriptArgs: "CommandLine" },
        { label: "Application_Close" },
        {
          label: "Application_PreInvokeMethod",
          scriptArgs: "MethodName",
          isPre: true,
        },
        {
          label: "Application_InvokeMethod",
          scriptArgs: "MethodName",
        },
        {
          label: "Application_PreNavigate",
          scriptArgs: "DestViewName, DestBusObjName",
          isPre: true,
        },
        { label: "Application_Navigate" },
        { label: "(declarations)" },
      ],
    },
    webtemp: { parent: "Web Template", child: "", defaultScripts: [] },
  } as const,
  //fields
  fields = {
    name: "Name",
    script: "Script",
    definition: "Definition",
  } as const,
  //constant query params
  query = {
    search: {},
    testConnection: { fields: "Name" },
    allWorkspaces: {
      fields: "Name,Status",
      ViewMode: "Organization",
    },
    editableWorkspaces: {
      fields: "Name",
      searchSpec:
        "Status='Created' OR Status='Checkpointed' OR Status='Edit-In-Progress'",
    },
    pullScript: { fields: "Name,Script" },
    pullScripts: { fields: "Name,Script", searchSpec: "Inactive <> 'Y'" },
    pullDefinition: { fields: "Name,Definition" },
    compareScript: { fields: "Name,Script" },
    compareDefinition: { fields: "Name,Definition" },
  } as const,
  //constant paths
  paths = {
    workspaces: "data/Workspace/Repository Workspace",
    test: "workspace/MAIN/Application",
    project: "Project",
  } as const,
  //constant for message box answers
  deleteNo = ["Delete", "No"] as const,
  revertNo = ["Revert", "No"] as const,
  pushNo = ["Push", "No"] as const,
  pushAllNo = ["Push All", "No"] as const,
  itemStates = {
    offline: {
      icon: new vscode.ThemeIcon("library"),
      tooltip: "Showing objects on disk",
    },
    online: {
      icon: new vscode.ThemeIcon("plug", new vscode.ThemeColor("charts.green")),
      tooltip: "Showing data from Siebel, last search: ",
    },
    disk: {
      icon: new vscode.ThemeIcon(
        "device-desktop",
        new vscode.ThemeColor("charts.blue")
      ),
      tooltip: "On disk",
    },
    siebel: {
      icon: new vscode.ThemeIcon(
        "cloud",
        new vscode.ThemeColor("charts.yellow")
      ),
      tooltip: "In Siebel",
    },
    same: {
      icon: new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("charts.green")
      ),
      tooltip: "Synchronized",
    },
    differ: {
      icon: new vscode.ThemeIcon(
        "request-changes",
        new vscode.ThemeColor("charts.red")
      ),
      tooltip: "Modified",
    },
  } as const,
  selectCommand = {
    command: "siebelscriptandwebtempeditor.selectTreeItem",
    title: "Select",
  } as const,
  //config webview options:
  configOptions = {
    enableScripts: true,
    retainContextWhenHidden: true,
  } as const,
  //datasource webview options
  dataSourceOptions = { enableScripts: true } as const,
  //open file options
  openFileOptions = { preview: false } as const,
  //compare options
  compareOptions = {
    title: "Choose a workspace to compare against",
    placeHolder: "Workspace",
    canPickMany: false,
  } as const,
  //new custom script quickpick item
  customScriptItem = {
    label: "Custom",
    description: "Create a custom server script",
  } as const,
  //new script options
  newScriptOptions = {
    placeHolder:
      "Choose the server script to be created or select Custom and enter its name",
    canPickMany: false,
  } as const,
  //new service options
  projectOptions = {
    title: "Choose a project for the new business service",
    placeHolder: "Project name",
    canPickMany: false,
  } as const,
  //find in files options
  findInFilesOptions = {
    triggerSearch: true,
    isRegex: false,
    isCaseSensitive: false,
    matchWholeWord: false,
  } as const,
  projectInput = {
    placeHolder: "Enter the search string for the Siebel project name",
  } as const,
  serviceInput = {
    placeHolder: "Enter the name of the new business service",
  } as const,
  //html to show when there is no workspace folder open
  workspaceDialogOptions = {
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title:
      "Select a workspace folder for the Siebel Script And Web Template Editor extension",
  } as const,
  //object to disable all buttons
  disableAllButtons = {
    push: false,
    pushAll: false,
    search: false,
    compare: false,
  } as const,
  //constant error messages
  error = {
    search: "",
    testConnection: "Error in the Siebel REST API Base URI!",
    allWorkspaces:
      "Error getting workspaces from the Siebel REST API, [see documentation for more information!](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)",
    editableWorkspaces:
      "No workspace with status Created, Checkpointed or Edit-In-Progress was found!",
    pullScript: "Unable to pull, script was not found in Siebel!",
    pullScripts: "Unable to pull, object was not found in Siebel!",
    pullDefinition: "Unable to pull, web template was not found in Siebel!",
    compareScript:
      "Unable to compare, script does not exists in the selected workspace!",
    compareDefinition:
      "Unable to compare, web template does not exists in the selected workspace!",
    noConnection:
      "Please create at least one connection with the New Connection button!",
    connectionExists: "Connection with the same name already exists!",
    nameDifferent:
      "Unable to push script, name of the file and the function is not the same!",
  } as const,
  //error when parsing active file
  buttonError = new Error();

export type ItemStates = (typeof itemStates)[keyof typeof itemStates];
