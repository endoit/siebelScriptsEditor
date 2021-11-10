const DBQuery = require ('./dbQuery.js');

const getWSandRepoData = async () => {
    const wsobj = {ws: {}, repo: {}};
    const queryStringWS = "SELECT * FROM SIEBEL.S_WORKSPACE WHERE CREATED < SYSDATE";
    const wsdata = await DBQuery.dbQuery(queryStringWS);
    wsdata.rows.forEach((row) => {wsobj.ws[row.NAME] = row.ROW_ID})
    const queryStringRepo = "SELECT * FROM SIEBEL.S_REPOSITORY WHERE CREATED < SYSDATE";
    const repodata = await DBQuery.dbQuery(queryStringRepo);
    repodata && repodata.rows.forEach((row) => {wsobj.repo[row.NAME] = row.ROW_ID})
    return wsobj;
};

exports.getWSandRepoData = getWSandRepoData;

const getBusinessServices = async (wsid, repoid) => {
    const bsobj = {};
    const queryStringBS = `SELECT * FROM SIEBEL.S_SERVICE WHERE CREATED < SYSDATE AND WS_ID='${wsid}' AND REPOSITORY_ID='${repoid}'`;
    const bsdata = await DBQuery.dbQuery(queryStringBS);
    bsdata && bsdata.rows.forEach((row) => {bsobj[row.NAME] = row.ROW_ID })
    return bsobj;
};

exports.getBusinessServices = getBusinessServices;