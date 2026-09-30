import * as vscode from "vscode";
import { create } from "axios";

export type Query = {
  params: {
    searchSpec?: string;
    workspace?: "MAIN";
    fields?: (typeof fields)[keyof typeof fields];
    PageSize?: Config["maxPageSize"];
    StartRowNum?: number;
  };
  error?: string;
};

export type Script =
  | typeof SERVICE
  | typeof BUSCOMP
  | typeof APPLET
  | typeof APPLICATION;

export type WebTemp = typeof WEBTEMP;

export type BusObject = typeof BUSOBJECT;

export type Type = Script | WebTemp;

export type Payload = ReturnType<typeof getPayload>;

export type RestResponse = {
  Name: string;
  Script?: string;
  Definition?: string;
  Status?: string;
  RepositoryWorkspace?: RestResponse[];
  PickList?: string;
};

export type RestConfig = {
  url: string;
  username: string;
  password: string;
  fileExtension: "js" | "ts" | "escript";
  maxPageSize: "10" | "20" | "50" | "100" | "200" | "500";
};

export type Config = {
  name: string;
  isDefault: boolean;
  restWorkspaces: boolean;
} & RestConfig;

const restApi = create({
  withCredentials: true,
  params: {
    uniformresponse: "y",
    childlinks: "None",
  },
});

export const SERVICE = "Business Service",
  BUSCOMP = "Business Component",
  APPLET = "Applet",
  APPLICATION = "Application",
  WEBTEMP = "Web Template",
  BUSOBJECT = "Business Object",
  paths = {
    [SERVICE]: "Business Service Server Script",
    [BUSCOMP]: "BusComp Server Script",
    [APPLET]: "Applet Server Script",
    [APPLICATION]: "Application Server Script",
    [BUSOBJECT]: "Business Object Component",
    project: "Project",
    field: "Field",
    pickList: "Pick List",
    workspace: "data/Workspace/Repository Workspace",
    test: "workspace/MAIN/Application",
  } as const,
  fields = {
    name: "Name",
    script: "Script",
    nameScript: "Name,Script",
    definition: "Definition",
    nameDefinition: "Name,Definition",
    nameStatus: "Name,Status",
    namePickList: "Name,PickList",
    projectName: "Project Name",
  } as const,
  searchSpec = {
    workspace:
      "Status='Created' OR Status='Checkpointed' OR Status='Edit-In-Progress'",
    inactive: "Inactive <> 'Y'",
    pickList: "Inactive <> 'Y' AND Type Value IS NOT NULL",
  } as const,
  queryObject = {
    testConnection: {
      params: { fields: fields.name },
      error: "Error in the Siebel REST API Base URI!",
    },
    allWorkspaces: {
      params: {
        fields: fields.nameStatus,
        ViewMode: "Organization",
      },
      error:
        "Error getting workspaces from the Siebel REST API, [see documentation for more information!](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)",
    },
    editableWorkspaces: {
      params: {
        fields: fields.name,
        searchSpec: searchSpec.workspace,
      },
      error:
        "No workspace with status Created, Checkpointed or Edit-In-Progress was found!",
    },
    pullScript: {
      params: { fields: fields.nameScript },
      error: "Unable to pull, script was not found in Siebel!",
    },
    pullScripts: {
      params: { fields: fields.nameScript, searchSpec: searchSpec.inactive },
      error: "",
    },
    pullDefinition: {
      params: { fields: fields.nameDefinition },
      error: "Unable to pull, web template was not found in Siebel!",
    },
    pullBusObject: {
      params: { fields: fields.name, searchSpec: searchSpec.inactive },
    },
    pullBusComp: {
      params: { fields: fields.namePickList, searchSpec: searchSpec.inactive },
    },
    pullPickList: {
      params: {
        fields: fields.name,
        searchSpec: searchSpec.pickList,
      },
    },
    compareScript: {
      params: { fields: fields.nameScript },
      error:
        "Unable to compare, script does not exists in the selected workspace!",
    },
    compareDefinition: {
      params: { fields: fields.nameDefinition },
      error:
        "Unable to compare, web template does not exists in the selected workspace!",
    },
  } as const;

export const getSearchQuery = (
  field: typeof fields.name | typeof fields.nameDefinition,
  searchString: string,
) => ({
  params: {
    fields: field,
    searchSpec: `Name LIKE '${searchString}*' AND Inactive <> 'Y'`,
  },
});

export const joinPath = (...parts: string[]) => parts.join("/");

export const joinWorkspace = (...parts: string[]) =>
  joinPath("workspace", ...parts);

export const joinUrl = (url: string, workspace: string) =>
  joinPath(url, joinWorkspace(workspace));

export const joinChild = (type: Script | BusObject, name: string) =>
  joinPath(type, name, paths[type]);

export const getPayload = (
  Name: string,
  field:
    | typeof fields.script
    | typeof fields.definition
    | typeof fields.projectName,
  content: string,
) => {
  const payload = { Name, [field]: content };
  if (field === fields.script) payload["Program Language"] = "JS";
  return payload;
};

export const getObject = async (
  { url: baseURL, username, password, maxPageSize = "100" }: RestConfig,
  path: string,
  query: Query,
  firstPageOnly = true,
): Promise<RestResponse[]> => {
  try {
    const request = {
      baseURL,
      auth: { username, password },
      params: {
        ...query.params,
        PageSize: Number(maxPageSize),
      },
    };

    let response = await restApi.get(path, request);

    const data = response?.data?.items ?? [];

    if (firstPageOnly) return data;

    //older Siebel versions does not accept StartRowNum param for fields
    //paged only for server scripts and fields
    request.params.StartRowNum = 1;

    while (response?.data?.lastpage === "false") {
      request.params.StartRowNum += request.params.PageSize;
      response = await restApi.get(path, request);
      data.push(...(response?.data?.items ?? []));
    }
    return data;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      err.response?.status === 404
        ? (query.error ?? "")
        : (err.response?.data?.ERROR ?? err.message),
    );
    return [];
  }
};

export const putObject = async (
  { url: baseURL, username, password }: RestConfig,
  path: string,
  data: Payload,
) => {
  try {
    const request = { baseURL, auth: { username, password } };
    await restApi.put(path, data, request);
    return true;
  } catch (err: any) {
    vscode.window.showErrorMessage(
      `Error using the Siebel REST API: ${err.response?.data?.ERROR ?? err.message}`,
    );
    return false;
  }
};
