//Repository object urls and names
export const entity = {
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
      searchspec: "Status='Checkpointed' OR Status='Edit-In-Progress'",
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
  //constant success and error messages messages
  success = {
    pull: "",
    push: "Successfully pushed object to Siebel!",
    testConnection: "Connection is working!",
    testRestWorkspaces:
      "Getting workspaces from the Siebel REST API was successful!",
    restWorkspaces: "",
  } as const,
  error = {
    pull: "Error when pulling from Siebel:",
    push: "Error when pushing to Siebel:",
    testConnection: "Error in the connection:",
    testRestWorkspaces:
      "Error getting workspaces from the Siebel REST API, Base Workspace integration object is missing or check the REST API connection!",
    restWorkspaces:
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
      "Unable to push script, name of the file and the function is not the same!",
  } as const;
