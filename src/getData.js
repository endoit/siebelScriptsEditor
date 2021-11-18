const DBQuery = require ('./dbQuery.js');
const fs = require('fs');
const vscode = require('vscode');
const path = require('path');
const filesRW = require('./filesRW');
const config = require('../config');

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
    const queryStringRepo = "SELECT ROW_ID, NAME FROM SIEBEL.S_REPOSITORY";
    const repodata = await DBQuery.dbQuery(queryStringRepo, database);
    repodata && repodata.rows.forEach((row) => {repobj[row.NAME] = row.ROW_ID});
    return repobj;
};

const getWSData = async (repoid, database) => {
    const wsobj = {};
    const queryStringWS = `SELECT ROW_ID, NAME FROM SIEBEL.S_WORKSPACE WHERE REPOSITORY_ID=:repo`;
    const wsdata = await DBQuery.dbQuery(queryStringWS, database, {repo: repoid});
    wsdata && wsdata.rows.forEach((row) => {wsobj[row.NAME] = row.ROW_ID});
    return wsobj;
};

const getSiebelData = async (params, type, folder) => {
    const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const siebobj = {};
    let exists;
    let fileNames;
    let queryStringSB = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].table} WHERE CREATED > TO_DATE(:datestr, 'yyyy-mm-dd') AND WS_ID=:ws AND REPOSITORY_ID=:repo`;
    if (params.scr === true){
        queryStringSB += ` AND ROW_ID IN (SELECT ${tablesAndIdColumns[type].idColumn} FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE SCRIPT IS NOT NULL)`
    }
    const bindedValues = {ws: params.ws, repo: params.repo, datestr: params.date || "1800-01-01"};
    const bsdata = await DBQuery.dbQuery(queryStringSB, params.db, bindedValues);
    bsdata && bsdata.rows.forEach((row) => {
        exists = fs.existsSync(`${wsPath}/${folder}/${type}/${row.NAME}`);
        siebobj[row.NAME] = {id: row.ROW_ID, scripts: {}, 
            onDisk: exists
        }
        if (exists){
            fileNames = fs.readdirSync(`${wsPath}/${folder}/${type}/${row.NAME}`);
            fileNames.forEach((file) => {if (path.extname(file) === ".js"){siebobj[row.NAME].scripts[path.basename(file, ".js")] = {onDisk: true}}});
        }
    });
    return siebobj;
};

const getServerScripts = async (params, type) => {
    const scriptobj = {};
    const queryStringSC = `SELECT ROW_ID, NAME, SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid`;
    const bindedValues = {ws: params.ws, repo: params.repo, parentid: params[type].id};
    const scdata = await DBQuery.dbQuery(queryStringSC, params.db, bindedValues);
    scdata && scdata.rows.forEach((row) => {scriptobj[row.NAME] = {id: row.ROW_ID, script: row.SCRIPT, onDisk: true}});
    return scriptobj;
}

const getServerScriptsNames = async (params, type, folderObj) => {
    const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const folderPath = `${folderObj.db}_${folderObj.repo}/${folderObj.ws}/${type}`;
    const scriptobj = {};
    const queryStringSC = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid`;
    const bindedValues = {ws: params.ws, repo: params.repo, parentid: params[type].id};
    const scdata = await DBQuery.dbQuery(queryStringSC, params.db, bindedValues);
    scdata && scdata.rows.forEach((row) => {scriptobj[row.NAME] = {id: row.ROW_ID, 
        onDisk: fs.existsSync(`${wsPath}/${folderPath}/${params[type].name}/${row.NAME}.js`)}});
    return scriptobj;
}

const getServerScriptMethod = async (params, type) => {
    const queryStringSC = `SELECT SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid AND ROW_ID=:methodid`;
    const bindedValues = {ws: params.ws, repo: params.repo, parentid: params[type].id, methodid: params[type].childId};
    const scdata = await DBQuery.dbQuery(queryStringSC, params.db, bindedValues);
    const scriptstr = scdata.rows[0].SCRIPT;
    return scriptstr;
}

const createBackup = async (params, type, backupFolder) => {
    let siebObj = {};
	let siebObjName;
    let siebObjVal;
    let scrName;
    let scrVal;
    let folder = `${backupFolder}/${type}`;
    siebObj = await getSiebelData(params, type, backupFolder);
    for ([siebObjName, siebObjVal] of Object.entries(siebObj)){
        params[type].id = siebObjVal.id;
        siebObj[siebObjName].scripts = await getServerScripts(params, type);
        for ([scrName, scrVal] of Object.entries(siebObj[siebObjName].scripts)){
            filesRW.writeFiles(scrVal.script, folder, siebObjName, scrName, true);
        }
    }
}

const pushOrPullScript = async (action) => {
    let currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (path.basename(currentlyOpenTabfilePath) === "info.json"){return}
    let scrName = path.basename(currentlyOpenTabfilePath, ".js");
    let dirPath = path.dirname(currentlyOpenTabfilePath);
    let infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
    let readData = await vscode.workspace.fs.readFile(infoFilePath);
    let scrFilePath = vscode.Uri.file(`${dirPath}/${scrName}.js`);
    let infoObj = JSON.parse(Buffer.from(readData));
    switch (action){
        case "pull": {
            const queryStringSC = `SELECT SCRIPT FROM SIEBEL.${tablesAndIdColumns[infoObj.type].scriptTable} WHERE WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[infoObj.type].idColumn}=:parentid AND ROW_ID=:methodid`;
            const bindedValues = {ws: infoObj.ws.id, repo: infoObj.repo.id, parentid: infoObj.siebelObject.id, methodid: infoObj.scripts[scrName].id};
            const scdata = await DBQuery.dbQuery(queryStringSC, infoObj.db, bindedValues);
            const scriptstr = scdata.rows[0].SCRIPT;
            const wsEdit = new vscode.WorkspaceEdit();
            wsEdit.createFile(scrFilePath, { overwrite: true, ignoreIfExists: false });
            await vscode.workspace.applyEdit(wsEdit);
            const writeData = Buffer.from(scriptstr, 'utf8');
            vscode.workspace.fs.writeFile(scrFilePath, writeData);
            infoObj.scripts[scrName]["last update from database"] = new Date().toString();
            break;
        }
        case "push": {
            const scrDataRead = await vscode.workspace.fs.readFile(scrFilePath);
            const scrText = Buffer.from(scrDataRead).toString();
            const updateStringSC = `UPDATE SIEBEL.${tablesAndIdColumns[infoObj.type].scriptTable} SET SCRIPT=:script, LAST_UPD=CURRENT_TIMESTAMP WHERE WS_ID=:ws AND REPOSITORY_ID=:repo AND ${tablesAndIdColumns[infoObj.type].idColumn}=:parentid AND ROW_ID=:methodid`;
            const bindedValues = {ws: infoObj.ws.id, repo: infoObj.repo.id, parentid: infoObj.siebelObject.id, methodid: infoObj.scripts[scrName].id, script: scrText};
            const resp = await DBQuery.dbQuery(updateStringSC, infoObj.db, bindedValues, true);
            console.log(resp)
            //infoObj.scripts[scrName]["last update from database"] = new Date().toString();
            infoObj.scripts[scrName]["last pull to database"] = new Date().toString();
            break;
        }
    }
    vscode.workspace.fs.writeFile(infoFilePath, Buffer.from(JSON.stringify(infoObj, null, 2), 'utf8'));
}

exports.getWSData = getWSData;
exports.getRepoData = getRepoData;
exports.getSiebelData = getSiebelData;
exports.getServerScripts = getServerScripts;
exports.getServerScriptsNames = getServerScriptsNames;
exports.getServerScriptMethod = getServerScriptMethod;
exports.createBackup = createBackup;
exports.pushOrPullScript = pushOrPullScript;