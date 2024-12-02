//Repository object urls
export const siebelObjectUrls: SiebelObjectUrls = {
    service: {
      parent: "Business Service",
      child: "Business Service Server Script",
    },
    buscomp: { parent: "Business Component", child: "BusComp Server Script" },
    applet: { parent: "Applet", child: "Applet Server Script" },
    application: { parent: "Application", child: "Application Server Script" },
    webtemp: { parent: "Web Template", child: "" },
  } as const,
  //constant query params
  query = {
    testConnection: {
      fields: "Name",
      workspace: "MAIN",
      uniformresponse: "y",
      childlinks: "None",
    },
    testRestWorkspaces: {
      fields: "Name",
      workspace: "MAIN",
      searchspec: "Name='Base Workspace'",
      uniformresponse: "y",
      childlinks: "None",
    },
    restWorkspaces: {
      fields: "Name",
      workspace: "MAIN",
      searchspec:
        "Status='Created' OR Status='Checkpointed' OR Status='Edit-In-Progress'",
      uniformresponse: "y",
      childlinks: "None",
    },
    pull: {
      Script: { uniformresponse: "y", childlinks: "None", fields: "Script" },
      Definition: {
        uniformresponse: "y",
        childlinks: "None",
        fields: "Definition",
      },
    },
  } as const,
  //constant paths
  paths = {
    testConnection: "workspace/MAIN/Integration Object",
    testRestWorkspaces: "workspace/MAIN/Integration Object",
    restWorkspaces: "data/Workspace/Repository Workspace",
  } as const,
  //constant arrays
  yesNo = ["Yes", "No"] as const,
  yesOnlyMethodNamesNo = ["Yes", "Only method names", "No"] as const,
  openFileOverwriteCancel = ["Open file", "Overwrite", "Cancel"] as const,
  buttonOptions = {
    pull: ["from", ["Pull", "No"], "get", false],
    compare: ["from", ["Compare", "No"], "get", true],
    push: ["to", ["Push", "No"], "put", false],
  } as const,
  //constant success and error messages messages
  success = {
    pull: "",
    compare: "",
    push: "Successfully pushed object to Siebel!",
    testConnection: "Connection is working!",
    testRestWorkspaces:
      "Getting workspaces from the Siebel REST API was successful!",
    restWorkspaces: "",
  } as const,
  error = {
    pull: "Unable to pull, object was not found in Siebel!",
    compare: "Unable to compare, object does not exists in the selected workspace!",
    push: "Unable to push, object was not found in Siebel!",
    testConnection: "Error in the Siebel REST API Base URI!",
    testRestWorkspaces:
      "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing!",
    restWorkspaces:
      "No workspace with status Created, Checkpointed or Edit-In-Progress was found!",
    noConnection:
      "Please create at least one connection with the New Connection button!",
    noBaseWorkspaceIOB:
      "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing or check the REST API connection!",
    connectionExists: "Connection with the same name already exists!",
    nameDifferent:
      "Unable to push script, name of the file and the function is not the same!"
  } as const;
