const DBQuery = require ('./dbQuery.js');
const fs = require('fs');
const vscode = require('vscode');

const tablesAndIdColumns = {
    service: {
        table: "S_SERVICE",
        scriptTable: "S_SERVICE_SCRPT",
        idColumn: "SERVICE_ID"
    },
    buscomp: {
        table: "S_BUSCOMP",
        scriptTable: "S_BUSCOMP_SCRIPT",
        idColumn: "BUSCOMP_ID"
    },
    applet: {
        table: "S_APPLET",
        scriptTable: "S_APPL_WEBSCRPT",
        idColumn: "APPLET_ID"
    },
    application: {
        table: "S_APPLICATION",
        scriptTable: "S_APPL_SCRIPT",
        idColumn: "APPLICATION_ID"
    }
};

const getRepoData = async (database) => {
    const repobj = {};
    const queryStringRepo = "SELECT ROW_ID, NAME FROM SIEBEL.S_REPOSITORY WHERE CREATED < SYSDATE";
    const repodata = await DBQuery.dbQuery(queryStringRepo, database);
    repodata && repodata.rows.forEach((row) => {repobj[row.NAME] = row.ROW_ID});
    return repobj;
};

const getWSData = async (repoid, database) => {
    const wsobj = {};
    const queryStringWS = `SELECT ROW_ID, NAME FROM SIEBEL.S_WORKSPACE WHERE CREATED < SYSDATE AND REPOSITORY_ID=:repo`;
    const wsdata = await DBQuery.dbQuery(queryStringWS, database, {repo: repoid});
    wsdata && wsdata.rows.forEach((row) => {wsobj[row.NAME] = row.ROW_ID});
    return wsobj;
};

const getSiebelData = async (params, type, folder) => {
    let wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const siebobj = {};
    let queryStringSB = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].table} WHERE CREATED > TO_DATE(:datestr, 'yyyy-mm-dd') AND WS_ID=:ws AND REPOSITORY_ID=:repo`;
    if (params.scr === true){
        queryStringSB += ` AND ROW_ID IN (SELECT ${tablesAndIdColumns[type].idColumn} FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE SCRIPT IS NOT NULL)`
    }
    const bindedValues = {ws: params.ws, repo: params.repo, datestr: params.date || "1800-01-01"};
    const bsdata = await DBQuery.dbQuery(queryStringSB, params.db, bindedValues);
    bsdata && bsdata.rows.forEach((row) => {siebobj[row.NAME] = {id: row.ROW_ID, scripts: {}, 
        onDisk: fs.existsSync(`${wsPath}/${folder}/${type}/${row.NAME}`)
    }});
    return siebobj;
};

const getServerScripts = async (params, type) => {
    const scriptobj = {};
    const queryStringSC = `SELECT ROW_ID, NAME, SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE CREATED < SYSDATE AND WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid`;
    const bindedValues = {ws: params.ws, repo: params.repo, parentid: params[type].id};
    const scdata = await DBQuery.dbQuery(queryStringSC, params.db, bindedValues);
    scdata && scdata.rows.forEach((row) => {scriptobj[row.NAME] = {id: row.ROW_ID, script: row.SCRIPT, onDisk: true}});
    return scriptobj
}

const getServerScriptsNames = async (params, type) => {
    const scriptobj = {};
    const queryStringSC = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE CREATED < SYSDATE AND WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid`;
    const bindedValues = {ws: params.ws, repo: params.repo, parentid: params[type].id};
    const scdata = await DBQuery.dbQuery(queryStringSC, params.db, bindedValues);
    scdata && scdata.rows.forEach((row) => {scriptobj[row.NAME] = {id: row.ROW_ID, onDisk: false}});
    return scriptobj
}

const getServerScriptMethod = async (params, type) => {
    const queryStringSC = `SELECT SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE CREATED < SYSDATE AND WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid AND ROW_ID=:methodid`;
    const bindedValues = {ws: params.ws, repo: params.repo, parentid: params[type].id, methodid: params[type].childId};
    const scdata = await DBQuery.dbQuery(queryStringSC, params.db, bindedValues);
    const scriptobj = scdata.rows[0].SCRIPT;
    console.log(scriptobj)
    return scriptobj
}

exports.getWSData = getWSData;
exports.getRepoData = getRepoData;
exports.getSiebelData = getSiebelData;
exports.getServerScripts = getServerScripts;
exports.getServerScriptsNames = getServerScriptsNames;
exports.getServerScriptMethod = getServerScriptMethod;