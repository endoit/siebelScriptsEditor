//Repository object urls
export const siebelObjectUrls = {
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
    testConnection: {
      fields: "Name",
      workspace: "MAIN",
    },
    editableWorkspaces: {
      fields: "Name",
      workspace: "MAIN",
      searchspec:
        "Status='Created' OR Status='Checkpointed' OR Status='Edit-In-Progress'",
    },
    allWorkspaces: {
      fields: "Name,Status",
      workspace: "MAIN",
      ViewMode: "Organization",
    },
    pullScript: { fields: "Script" },
    pullDefinition: { fields: "Definition" },
    compareScript: { fields: "Script" },
    compareDefinition: { fields: "Definition" },
    push: {},
    treeData: {},
  } as const,
  //constant paths
  paths = {
    testConnection: "workspace/MAIN/describe",
    restWorkspaces: "data/Workspace/Repository Workspace",
  } as const,
  //constant for message box answers
  yesNo = ["Yes", "No"] as const,
  yesOnlyMethodNamesNo = ["Yes", "Only method names", "No"] as const,
  openFileOverwriteCancel = ["Open file", "Overwrite", "Cancel"] as const,
  pullNo = ["Pull", "No"] as const,
  pushNo = ["Push", "No"] as const,
  //open file options
  openFileOptions = { preview: false } as const,
  //compare options
  compareOptions = {
    title: "Choose a workspace to compare against",
    placeHolder: "Workspace",
    canPickMany: false,
  } as const,
  //constant success and error messages messages
  success = {
    push: "Successfully pushed object to Siebel!",
    testConnection: "Connection is working!",
    testRestWorkspaces:
      "Getting workspaces from the Siebel REST API was successful!",
    editableWorkspaces: "",
    allWorkspaces: "",
    pullScript: "",
    pullDefinition: "",
    compareScript: "",
    compareDefinition: "",
    treeData: "",
  } as const,
  error = {
    push: "",
    pullScript: "Unable to pull, script was not found in Siebel!",
    pullDefinition: "Unable to pull, web template was not found in Siebel!",
    compareScript:
      "Unable to compare, script does not exists in the selected workspace!",
    compareDefinition:
      "Unable to compare, web template does not exists in the selected workspace!",
    testConnection: "Error in the Siebel REST API Base URI!",
    testRestWorkspaces: "",
    editableWorkspaces:
      "No workspace with status Created, Checkpointed or Edit-In-Progress was found!",
    allWorkspaces:
      "Error getting workspaces from the Siebel REST API, [see documentation for more information!](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)",
    noConnection:
      "Please create at least one connection with the New Connection button!",
    connectionExists: "Connection with the same name already exists!",
    nameDifferent:
      "Unable to push script, name of the file and the function is not the same!",
    treeData: "",
  } as const,
  //error when parsing active file
  buttonError = new Error();
