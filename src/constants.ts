import * as vscode from "vscode";

//Repository object paths adn scripts
export const metadata = {
    service: {
      parent: "Business Service",
      child: "Business Service Server Script",
      baseScriptItems: [
        { label: "Service_PreInvokeMethod" },
        { label: "Service_InvokeMethod" },
        { label: "Service_PreCanInvokeMethod" },
        { label: "(declarations)" },
      ],
    },
    buscomp: {
      parent: "Business Component",
      child: "BusComp Server Script",
      baseScriptItems: [
        { label: "BusComp_PreSetFieldValue" },
        { label: "BusComp_SetFieldValue" },
        { label: "BusComp_PreGetFieldValue" },
        { label: "BusComp_PreCopyRecord" },
        { label: "BusComp_CopyRecord" },
        { label: "BusComp_PreNewRecord" },
        { label: "BusComp_NewRecord" },
        { label: "BusComp_PreAssociate" },
        { label: "BusComp_Associate" },
        { label: "BusComp_PreDeleteRecord" },
        { label: "BusComp_DeleteRecord" },
        { label: "BusComp_PreWriteRecord" },
        { label: "BusComp_WriteRecord" },
        { label: "BusComp_ChangeRecord" },
        { label: "BusComp_PreQuery" },
        { label: "BusComp_Query" },
        { label: "BusComp_PreInvokeMethod" },
        { label: "BusComp_InvokeMethod" },
        { label: "(declarations)" },
      ],
    },
    applet: {
      parent: "Applet",
      child: "Applet Server Script",
      baseScriptItems: [
        { label: "WebApplet_PreInvokeMethod" },
        { label: "WebApplet_InvokeMethod" },
        { label: "WebApplet_ShowControl" },
        { label: "WebApplet_ShowListColumn" },
        { label: "WebApplet_PreCanInvokeMethod" },
        { label: "WebApplet_Load" },
        { label: "(declarations)" },
      ],
    },
    application: {
      parent: "Application",
      child: "Application Server Script",
      baseScriptItems: [
        { label: "Application_Start" },
        { label: "Application_Close" },
        { label: "Application_PreInvokeMethod" },
        { label: "Application_InvokeMethod" },
        { label: "Application_PreNavigate" },
        { label: "Application_Navigate" },
        { label: "(declarations)" },
      ],
    },
    webtemp: { parent: "Web Template", child: "", baseScriptItems: [] },
  } as const,
  //axios base config
  baseConfig = {
    withCredentials: true,
    params: {
      uniformresponse: "y",
      childlinks: "None",
    },
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
      searchspec:
        "Status='Created' OR Status='Checkpointed' OR Status='Edit-In-Progress'",
    },
    pullScript: { fields: "Name,Script" },
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
  yesNo = ["Yes", "No"] as const,
  pullNo = ["Pull", "No"] as const,
  pushNo = ["Push", "No"] as const,
  pushAllNo = ["Push All", "No"] as const,
  itemStates = {
    none: { icon: undefined, tooltip: undefined },
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
      tooltip: "Only on disk",
    },
    siebel: {
      icon: new vscode.ThemeIcon(
        "cloud",
        new vscode.ThemeColor("charts.yellow")
      ),
      tooltip: "Only in Siebel",
    },
    same: {
      icon: new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("charts.green")
      ),
      tooltip: "Identical in Siebel and on disk, last check: ",
    },
    differ: {
      icon: new vscode.ThemeIcon(
        "request-changes",
        new vscode.ThemeColor("charts.red")
      ),
      tooltip: "Differs between Siebel and disk, last check: ",
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
    title:
      "Choose the server script to be created or select Custom and enter its name",
    placeHolder: "Script",
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
  //constant error messages
  error = {
    search: "",
    testConnection: "Error in the Siebel REST API Base URI!",
    allWorkspaces:
      "Error getting workspaces from the Siebel REST API, [see documentation for more information!](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)",
    editableWorkspaces:
      "No workspace with status Created, Checkpointed or Edit-In-Progress was found!",
    pullScript: "Unable to pull, script was not found in Siebel!",
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
  buttonError = new Error(),
  //base scripts for new scripts
  baseScripts = {
    "(declarations)": "",
    Service_PreInvokeMethod: `function Service_PreInvokeMethod (MethodName, Inputs, Outputs)\n{\n\treturn (ContinueOperation);\n}`,
    Service_InvokeMethod: `function Service_InvokeMethod (MethodName, Inputs, Outputs)\n{\n\n}`,
    Service_PreCanInvokeMethod: `function Service_PreCanInvokeMethod (MethodName, &CanInvoke)\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_PreSetFieldValue: `function BusComp_PreSetFieldValue (FieldName, FieldValue)\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_SetFieldValue: `function BusComp_SetFieldValue (FieldName)\n{\n\n}`,
    BusComp_PreGetFieldValue: `function BusComp_PreGetFieldValue (FieldName, &FieldValue)\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_PreCopyRecord: `function BusComp_PreCopyRecord ()\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_CopyRecord: `function BusComp_CopyRecord ()\n{\n\n}`,
    BusComp_PreNewRecord: `function BusComp_PreNewRecord ()\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_NewRecord: `function BusComp_NewRecord ()\n{\n\n}`,
    BusComp_PreAssociate: `function BusComp_PreAssociate ()\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_Associate: `function BusComp_Associate ()\n{\n\n}`,
    BusComp_PreDeleteRecord: `function BusComp_PreDeleteRecord ()\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_DeleteRecord: `function BusComp_DeleteRecord ()\n{\n\n}`,
    BusComp_PreWriteRecord: `function BusComp_PreWriteRecord ()\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_WriteRecord: `function BusComp_WriteRecord ()\n{\n\n}`,
    BusComp_ChangeRecord: `function BusComp_ChangeRecord ()\n{\n\n}`,
    BusComp_PreQuery: `function BusComp_PreQuery ()\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_Query: `function BusComp_Query ()\n{\n\n}`,
    BusComp_PreInvokeMethod: `function BusComp_PreInvokeMethod (MethodName)\n{\n\treturn (ContinueOperation);\n}`,
    BusComp_InvokeMethod: `function BusComp_InvokeMethod (MethodName)\n{\n\n}`,
    WebApplet_PreInvokeMethod: `function WebApplet_PreInvokeMethod (MethodName)\n{\n\treturn (ContinueOperation);\n}`,
    WebApplet_InvokeMethod: `function WebApplet_InvokeMethod (MethodName)\n{\n\n}`,
    WebApplet_ShowControl: `function WebApplet_ShowControl (ControlName, Property, Mode, &HTML)\n{\n\n}`,
    WebApplet_ShowListColumn: `function WebApplet_ShowListColumn (ColumnName, Property, Mode, &HTML)\n{\n\n}`,
    WebApplet_PreCanInvokeMethod: `function WebApplet_PreCanInvokeMethod (MethodName, &CanInvoke)\n{\n\treturn (ContinueOperation);\n}`,
    WebApplet_Load: `function WebApplet_Load ()\n{\n\n}`,
    Application_Start: `function Application_Start (CommandLine)\n{\n\n}`,
    Application_Close: `function Application_Close ()\n{\n\n}`,
    Application_PreInvokeMethod: `function Application_PreInvokeMethod (MethodName)\n{\n\treturn (ContinueOperation);\n}`,
    Application_InvokeMethod: `function Application_InvokeMethod (MethodName)\n{\n\n}`,
    Application_PreNavigate: `function Application_PreNavigate (DestViewName, DestBusObjName)\n{\n\treturn (ContinueOperation);\n}`,
    Application_Navigate: `function Application_Navigate ()\n{\n\n}`,
  } as const;

export type ItemStates = (typeof itemStates)[keyof typeof itemStates];
