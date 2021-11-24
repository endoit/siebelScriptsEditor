const oracledb = require('oracledb');
const fs = require('fs');
const vscode = require('vscode');
const path = require('path');
const filesRW = require('./filesRW');

oracledb.outFormat = oracledb.OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

//handles the database operations
async function dbQuery(query, databaseConfig, bindings, commit) {
	let connection;
	let result;
	try {
		databaseConfig.events = true;
		//if (databaseConfig.configDir) { oracledb.initOracleClient({ configDir: databaseConfig.configDir }) };
		connection = await oracledb.getConnection(databaseConfig);
		result = await connection.execute(query, bindings || {});
		if (commit) { connection.commit() };
	} catch (err) {
		if (err.message.startsWith("ORA-00904")){
			result = "nowsidcolumn";
		} else {
			vscode.window.showErrorMessage("Error connecting to database: " + err.message);
		};
	} finally {
		if (connection) {
			try {
				await connection.close();
			} catch (err) {
				vscode.window.showErrorMessage("Error connecting to database: " + err.message);
			}
		}
		if (result) {
			return result;
		} else {
			return {};
		}
	}
}

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

const NO_WS_ID_COLUMN = 1;
const WS_NOT_IN_USE = 2;
const WS_ENABLED = 3;

//check if workspaces exists and are used
const checkForWorkspaces = async (databaseConf) => {
	const queryStringWSE = `SELECT ROW_ID FROM SIEBEL.S_APPLICATION WHERE WS_ID IS NOT NULL`;
	const wseData = await dbQuery(queryStringWSE, databaseConf);
	if (wseData === "nowsidcolumn"){
		return NO_WS_ID_COLUMN;
	} else if (wseData.rows && wseData.rows.length === 0){
		return WS_NOT_IN_USE;
	} else if (wseData.rows && wseData.rows.length > 0){
		return WS_ENABLED;
	}
}

//get repositories
const getRepoData = async (databaseConf) => {
	const repobj = {};
	const queryStringRepo = `SELECT ROW_ID, NAME FROM SIEBEL.S_REPOSITORY`;
	const repodata = await dbQuery(queryStringRepo, databaseConf);
	repodata && repodata.rows && repodata.rows.forEach((row) => { repobj[row.NAME] = row.ROW_ID });
	return repobj;
};

//get workspaces if Siebel version has them
const getWSData = async (repoid, databaseConf) => {
	if (databaseConf.workspaces !== WS_ENABLED){return {};}
	const wsobj = {};
	const queryStringWS = `SELECT ROW_ID, NAME FROM SIEBEL.S_WORKSPACE WHERE REPOSITORY_ID=:repo`;
	const wsdata = await dbQuery(queryStringWS, databaseConf, { repo: repoid });
	wsdata && wsdata.rows && wsdata.rows.forEach((row) => { wsobj[row.NAME] = row.ROW_ID });
	return wsobj;
};

//get siebel objects
const getSiebelData = async (params, databaseConf, type, folder) => {
	const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const siebobj = {};
	let exists;
	let fileNames;
	const bindedValues = {repo: params.repo, datestr: params.date || "1800-01-01" };
	let queryStringSB = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].table} WHERE CREATED > TO_DATE(:datestr, 'yyyy-mm-dd') AND REPOSITORY_ID=:repo`;
	if (databaseConf.workspaces === WS_ENABLED){
		queryStringSB += ` AND WS_ID=:ws`;
		bindedValues.ws = params.ws;
	} else if (databaseConf.workspaces === WS_NOT_IN_USE){
		queryStringSB += ` AND WS_ID IS NULL`;
	}
	if (params.scr === true) {
		queryStringSB += ` AND ROW_ID IN (SELECT ${tablesAndIdColumns[type].idColumn} FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE SCRIPT IS NOT NULL)`;
	}
	
	const bsdata = await dbQuery(queryStringSB, databaseConf, bindedValues);
	bsdata && bsdata.rows && bsdata.rows.forEach((row) => {
		exists = fs.existsSync(`${wsPath}/${folder}/${type}/${row.NAME}`);
		siebobj[row.NAME] = {
			id: row.ROW_ID, scripts: {},
			onDisk: exists
		}
		if (exists) {
			fileNames = fs.readdirSync(`${wsPath}/${folder}/${type}/${row.NAME}`);
			fileNames.forEach((file) => { if (path.extname(file) === ".js") { siebobj[row.NAME].scripts[path.basename(file, ".js")] = { onDisk: true } } });
		}
	});
	return siebobj;
};

//get all scripts for siebel object
const getServerScripts = async (params, databaseConf, type) => {
	const scriptobj = {};
	const bindedValues = { repo: params.repo, parentid: params[type].id };
	let queryStringSC = `SELECT ROW_ID, NAME, SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid`;
	if (databaseConf.workspaces === WS_ENABLED){
		queryStringSC += ` AND WS_ID=:ws`;
		bindedValues.ws = params.ws;
	} else if (databaseConf.workspaces === WS_NOT_IN_USE){
		queryStringSC += ` AND WS_ID IS NULL`;
	}
	const scdata = await dbQuery(queryStringSC, databaseConf, bindedValues);
	scdata && scdata.rows && scdata.rows.forEach((row) => { scriptobj[row.NAME] = { id: row.ROW_ID, script: row.SCRIPT, onDisk: true } });
	return scriptobj;
}

//get only the script names for siebel object
const getServerScriptsNames = async (params, databaseConf, type, folderObj) => {
	const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const folderPath = `${folderObj.db}_${folderObj.repo}/${folderObj.ws}/${type}`;
	const scriptobj = {};
	const bindedValues = { repo: params.repo, parentid: params[type].id };
	let queryStringSC = `SELECT ROW_ID, NAME FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid`;
	if (databaseConf.workspaces === true){
		queryStringSC += ` AND WS_ID=:ws`;
		bindedValues.ws = params.ws;
	} else if (databaseConf.workspaces === WS_NOT_IN_USE){
		queryStringSC += ` AND WS_ID IS NULL`;
	}
	const scdata = await dbQuery(queryStringSC, databaseConf, bindedValues);
	scdata && scdata.rows && scdata.rows.forEach((row) => {
		scriptobj[row.NAME] = {
			id: row.ROW_ID,
			onDisk: fs.existsSync(`${wsPath}/${folderPath}/${params[type].name}/${row.NAME}.js`)
		}
	});
	return scriptobj;
}

//get selected method for siebel object
const getServerScriptMethod = async (params, databaseConf, type) => {
	const bindedValues = { repo: params.repo, parentid: params[type].id, methodid: params[type].childId };
	let queryStringSC = `SELECT SCRIPT FROM SIEBEL.${tablesAndIdColumns[type].scriptTable} WHERE REPOSITORY_ID=:repo AND ${tablesAndIdColumns[type].idColumn}=:parentid AND ROW_ID=:methodid`;
	if (databaseConf.workspaces === true){
		queryStringSC += ` AND WS_ID=:ws`;
		bindedValues.ws = params.ws;
	} else if (databaseConf.workspaces === WS_NOT_IN_USE){
		queryStringSC += ` AND WS_ID IS NULL`;
	}
	const scdata = await dbQuery(queryStringSC, databaseConf, bindedValues);
	const scriptstr = scdata.rows && scdata.rows[0].SCRIPT;
	return scriptstr;
}

//create backup from selected workspace
const createBackup = async (params, databaseConf, type, backupFolder) => {
	let siebObj = {};
	let siebObjName;
	let siebObjVal;
	let scrName;
	let scrVal;
	let folder = `${backupFolder}/${type}`;
	siebObj = await getSiebelData(params, databaseConf, type, backupFolder);
	for ([siebObjName, siebObjVal] of Object.entries(siebObj)) {
		params[type].id = siebObjVal.id;
		siebObj[siebObjName].scripts = await getServerScripts(params, databaseConf, type);
		for ([scrName, scrVal] of Object.entries(siebObj[siebObjName].scripts)) {
			filesRW.writeFiles(scrVal.script, folder, siebObjName, scrName, true);
		}
	}
}

//push/pull script from/to database
const pushOrPullScript = async (action, databaseObj) => {
	let currentlyOpenTabfilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
	if (path.basename(currentlyOpenTabfilePath).endsWith(".js") === false) { 
		vscode.window.showInformationMessage("Currently active file is not a Siebel Object script or its extension is not .js!");
		return; 
	}
	let scrName = path.basename(currentlyOpenTabfilePath, ".js");
	let dirPath = path.dirname(currentlyOpenTabfilePath);
	let infoFilePath = vscode.Uri.file(`${dirPath}/info.json`);
	if (fs.existsSync(infoFilePath.fsPath) === false){
		vscode.window.showInformationMessage("File info.json was not found, please get the Siebel Object again from the extension!");
		return; 
	}
	let readData = await vscode.workspace.fs.readFile(infoFilePath);
	let scrFilePath = vscode.Uri.file(`${dirPath}/${scrName}.js`);
	let infoObj = JSON.parse(Buffer.from(readData));
	if (infoObj.scripts.hasOwnProperty(scrName) === false){
		vscode.window.showInformationMessage("Script was not found in info.json, please get the Siebel Object script again from the extension or check for accidental renaming!");
		return; 
	}
	switch (action) {
		case "pull": {
			const bindedValues = { repo: infoObj.repo.id, parentid: infoObj.siebelObject.id, methodid: infoObj.scripts[scrName].id };
			let queryStringSC = `SELECT SCRIPT FROM SIEBEL.${tablesAndIdColumns[infoObj.type].scriptTable} WHERE REPOSITORY_ID=:repo AND ${tablesAndIdColumns[infoObj.type].idColumn}=:parentid AND ROW_ID=:methodid`;
			if (databaseObj[infoObj.db].workspaces === WS_ENABLED){
				queryStringSC += ` AND WS_ID=:ws`
				bindedValues.ws =  infoObj.ws.id;
			} else if (databaseObj[infoObj.db].workspaces === WS_NOT_IN_USE){
				queryStringSC += ` AND WS_ID IS NULL`
			}
			const scdata = await dbQuery(queryStringSC, databaseObj[infoObj.db], bindedValues);
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
			const commit = true;
			const scrDataRead = await vscode.workspace.fs.readFile(scrFilePath);
			const scrText = Buffer.from(scrDataRead).toString();
			const bindedValues = { repo: infoObj.repo.id, parentid: infoObj.siebelObject.id, methodid: infoObj.scripts[scrName].id, script: scrText };
			let updateStringSC = `UPDATE SIEBEL.${tablesAndIdColumns[infoObj.type].scriptTable} SET SCRIPT=:script, LAST_UPD=CURRENT_TIMESTAMP WHERE REPOSITORY_ID=:repo AND ${tablesAndIdColumns[infoObj.type].idColumn}=:parentid AND ROW_ID=:methodid`;
			if (databaseObj[infoObj.db].workspaces === WS_ENABLED){
				updateStringSC += ` AND WS_ID=:ws`
				bindedValues.ws =  infoObj.ws.id;
			} else if (databaseObj[infoObj.db].workspaces === WS_NOT_IN_USE){
				updateStringSC += ` AND WS_ID IS NULL`;
			}
			const resp = await dbQuery(updateStringSC, databaseObj[infoObj.db], bindedValues, commit);
			if(resp.rowsAffected === 1){
				vscode.window.showInformationMessage("Successfully updated script in the database!");
				infoObj.scripts[scrName]["last push to database"] = new Date().toString();
			} else {
				vscode.window.showErrorMessage("Update was unsuccessful, check database connection!");
			}
			break;
		}
	}
	vscode.workspace.fs.writeFile(infoFilePath, Buffer.from(JSON.stringify(infoObj, null, 2), 'utf8'));
}

exports.checkForWorkspaces = checkForWorkspaces;
exports.getWSData = getWSData;
exports.getRepoData = getRepoData;
exports.getSiebelData = getSiebelData;
exports.getServerScripts = getServerScripts;
exports.getServerScriptsNames = getServerScriptsNames;
exports.getServerScriptMethod = getServerScriptMethod;
exports.createBackup = createBackup;
exports.pushOrPullScript = pushOrPullScript;