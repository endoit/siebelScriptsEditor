const DBQuery = require ('./dbQuery.js');
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
    const queryStringWS = `SELECT ROW_ID, NAME FROM SIEBEL.S_WORKSPACE WHERE CREATED < SYSDATE AND REPOSITORY_ID='${repoid}'`;
    const wsdata = await DBQuery.dbQuery(queryStringWS, database);
    wsdata && wsdata.rows.forEach((row) => {wsobj[row.NAME] = row.ROW_ID});
    return wsobj;
};

const getSiebelData = async (wsid, repoid, type, database) => {
    const siebobj = {};
    const queryStringSB = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].table} WHERE CREATED < SYSDATE AND WS_ID='${wsid}' AND REPOSITORY_ID='${repoid}'`;
    const bsdata = await DBQuery.dbQuery(queryStringSB, database);
    bsdata && bsdata.rows.forEach((row) => {siebobj[row.NAME] = {id: row.ROW_ID, scripts: {}, onDisk: false}});
    return siebobj;
};

const getServerScripts = async (wsid, repoid, parentid, type, database) => {
    const scriptobj = {};
    const queryStringSC = `SELECT ROW_ID, NAME, SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE CREATED < SYSDATE AND WS_ID='${wsid}' AND REPOSITORY_ID='${repoid}' AND ${tablesAndIdColumns[type].idColumn}='${parentid}'`;
    const scdata = await DBQuery.dbQuery(queryStringSC, database);
    scdata && scdata.rows.forEach((row) => {if (row.NAME !== "(declarations)"){scriptobj[row.NAME] = {id: row.ROW_ID, script: "", onDisk: true}}});
    return scriptobj
}

exports.getWSData = getWSData;
exports.getRepoData = getRepoData;
exports.getSiebelData = getSiebelData;
exports.getServerScripts = getServerScripts;