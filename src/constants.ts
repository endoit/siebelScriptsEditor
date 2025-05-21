//Repository object urls
export const objectUrlParts = {
    service: {
      parent: "Business Service",
      child: "Business Service Server Script",
    },
    buscomp: { parent: "Business Component", child: "BusComp Server Script" },
    applet: { parent: "Applet", child: "Applet Server Script" },
    application: { parent: "Application", child: "Application Server Script" },
    webtemp: { parent: "Web Template", child: "" },
  } as const,
  //axios base config
  baseConfig = {
    withCredentials: true,
    params: {
      uniformresponse: "y",
      childlinks: "None",
    },
  },
  //constant query params
  query = {
    editableWorkspaces: {
      fields: "Name",
      searchspec:
        "Status='Created' OR Status='Checkpointed' OR Status='Edit-In-Progress'",
    },
    allWorkspaces: {
      fields: "Name,Status",
      ViewMode: "Organization",
    },
    pullScript: { fields: "Name,Script" },
    pullDefinition: { fields: "Definition" },
    compareScript: { fields: "Script" },
    compareDefinition: { fields: "Definition" },
    testConnection: { fields: "Name" },
    push: {},
    treeData: {},
  } as const,
  //constant paths
  paths = {
    test: "workspace/MAIN/Application",
    workspaces: "data/Workspace/Repository Workspace",
  } as const,
  //constant for message box answers
  yesNo = ["Yes", "No"] as const,
  yesOnlyMethodNamesNo = ["Yes", "Only method names", "No"] as const,
  openFileOverwriteCancel = ["Open file", "Overwrite", "Cancel"] as const,
  pullNo = ["Pull", "No"] as const,
  pushNo = ["Push", "No"] as const,
  pushAllNo = ["Push all", "No"] as const,
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
  //find in files options
  findInFilesOptions = {
    triggerSearch: true,
    isRegex: false,
    isCaseSensitive: false,
    matchWholeWord: false,
  } as const,
  //constant error messages
  error = {
    testConnection: "Error in the Siebel REST API Base URI!",
    pullScript: "Unable to pull, script was not found in Siebel!",
    pullDefinition: "Unable to pull, web template was not found in Siebel!",
    compareScript:
      "Unable to compare, script does not exists in the selected workspace!",
    compareDefinition:
      "Unable to compare, web template does not exists in the selected workspace!",
    editableWorkspaces:
      "No workspace with status Created, Checkpointed or Edit-In-Progress was found!",
    allWorkspaces:
      "Error getting workspaces from the Siebel REST API, [see documentation for more information!](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)",
    noConnection:
      "Please create at least one connection with the New Connection button!",
    connectionExists: "Connection with the same name already exists!",
    nameDifferent:
      "Unable to push script, name of the file and the function is not the same!",
    push: "",
    treeData: "",
  } as const,
  //error when parsing active file
  buttonError = new Error();
