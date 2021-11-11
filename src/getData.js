const DBQuery = require ('./dbQuery.js');

const getRepoData = async (database) => {
    const repobj = {};
    const queryStringRepo = "SELECT ROW_ID, NAME FROM SIEBEL.S_REPOSITORY WHERE CREATED < SYSDATE";
    const repodata = await DBQuery.dbQuery(queryStringRepo, database);
    repodata && repodata.rows.forEach((row) => {repobj[row.NAME] = row.ROW_ID})
    return repobj;
};

const getWSData = async (repoid, database) => {
    const wsobj = {};
    const queryStringWS = `SELECT ROW_ID, NAME FROM SIEBEL.S_WORKSPACE WHERE CREATED < SYSDATE AND REPOSITORY_ID='${repoid}'`;
    const wsdata = await DBQuery.dbQuery(queryStringWS, database);
    wsdata.rows.forEach((row) => {wsobj[row.NAME] = row.ROW_ID})
    return wsobj;
};

const getSiebelData = async (wsid, repoid, type, database) => {
    const siebobj = {};
    const queryStringSB = `SELECT ROW_ID, NAME FROM SIEBEL.${type} WHERE CREATED < SYSDATE AND WS_ID='${wsid}' AND REPOSITORY_ID='${repoid}'`;
    const bsdata = await DBQuery.dbQuery(queryStringSB, database);
    bsdata && bsdata.rows.forEach((row) => {siebobj[row.NAME] = {id: row.ROW_ID, onDisk: false}})
    return siebobj;
};

exports.getWSData = getWSData;
exports.getRepoData = getRepoData;
exports.getSiebelData = getSiebelData;