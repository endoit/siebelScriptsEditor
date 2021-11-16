const vscode = require('vscode');
const path = require('path');
const getData = require('./getData.js');
const filesRW = require('./filesRW.js');

const messageText = {
    service: "business service",
    buscomp: "business component",
    applet: "applet",
    application: "application"
}

const selectionChange = async (e, type, selected, dataObj, treeObj, folderObj) => {
	const folderPath = `${folderObj.db}_${folderObj.repo}/${folderObj.ws}/${type}`;
    let answer;
    let item;

    if (e.selection[0].hasOwnProperty("scripts") === false){
        selected[type].childId = dataObj[e.selection[0].parent].scripts[e.selection[0].label].id;
        answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} ${messageText[type]} method from the Siebel database?`, ...["Yes", "No"]);
        if (answer === "Yes"){
            dataObj[e.selection[0].parent].scripts[e.selection[0].label].script = await getData.getServerScriptMethod(selected, type);
            dataObj[e.selection[0].parent].scripts[e.selection[0].label].onDisk = true;
            filesRW.writeFiles(dataObj[e.selection[0].parent].scripts[e.selection[0].label].script, folderPath, e.selection[0].parent, e.selection[0].label);
            //aInfos = [wsName, sWSId, bsName, sBSId, [e.selection[0].label]]
            //filesRW.writeInfo(aInfos, wsName, bsName);
            treeObj.refresh(dataObj);
        }
        return;
    }
    selected[type].id = dataObj[e.selection[0].label].id;
    selected[type].name = e.selection[0].label;
    answer = await vscode.window.showInformationMessage(`Do you want to get the ${e.selection[0].label} ${messageText[type]} from the Siebel database?`, ...["Yes", "Only method names"]);
    if (answer === "Yes"){
        dataObj[e.selection[0].label].onDisk = true;
        dataObj[e.selection[0].label].scripts = await getData.getServerScripts(selected, type);
        for (item in dataObj[e.selection[0].label].scripts){
            filesRW.writeFiles(dataObj[e.selection[0].label].scripts[item].script, folderPath, e.selection[0].label, item);
        }
        treeObj.refresh(dataObj);
    }
    if (answer === "Only method names"){
        dataObj[e.selection[0].label].scripts = await getData.getServerScriptsNames(selected, type);
        console.log(dataObj[e.selection[0].label])
        treeObj.refresh(dataObj);
    }
}

class TreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(dataObj) {
        this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, dataObj[bs].onDisk, dataObj[bs].scripts));    
    }

    getTreeItem(element){
        return element;
    }

    getChildren(element){
        if (element === undefined){
            return this.data;
        }
        return Object.keys(element.scripts).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.None, element.scripts[bs].onDisk, false, element.label));
    }

    refresh(dataObj){
        this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, dataObj[bs].onDisk, dataObj[bs].scripts));
        this._onDidChangeTreeData.fire();
    }
}
  
class TreeItem extends vscode.TreeItem {
    constructor(label, collabsibleState, onDisk, scripts, parent){ 
        super(label, collabsibleState);
        if (scripts){
            this.scripts = scripts;
        } else {
            this.parent = parent;
        }
        if (onDisk === true){
            this.iconPath = {
                light: path.join(__filename, "..", "..", "media", "checkmark.svg"), 
                dark: path.join(__filename, "..", "..", "media", "checkmark.svg")}
            } 
        
    }
}

exports.selectionChange = selectionChange;
exports.TreeDataProvider = TreeDataProvider;