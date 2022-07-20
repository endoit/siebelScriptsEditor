const vscode = require('vscode');
const path = require('path');
const dataService = require('./dataService.js');
const filesRW = require('./filesRW.js');

const messageText = {
    service: "business service",
    buscomp: "business component",
    applet: "applet",
    application: "application"
}

//handle selection in the tree views
const selectionChange = async (e, type, selected, dataObj, treeObj) => {
    const folderPath = `${selected.connection}/${selected.workspace}/${type}`;
    const ONLY_METHOD_NAMES = true;
    const selItem = e.selection[0];
    let answer;
    let scrName;
    let scrMethod;
    let scrNames = [];
    if (selItem.hasOwnProperty("scripts") === false) {
        selected[type].name = selItem.parent;
        selected[type].childName = selItem.label;     
        answer = await vscode.window.showInformationMessage(`Do you want to get the ${selItem.label} ${messageText[type]} method from the Siebel database?`, "Yes", "No");
        if (answer === "Yes") {
            dataObj[selItem.parent].onDisk = true;
            dataObj[selItem.parent].scripts[selItem.label].script = await dataService.getServerScriptMethod(selected, type);
            dataObj[selItem.parent].scripts[selItem.label].onDisk = true;
            filesRW.writeFiles(dataObj[selItem.parent].scripts[selItem.label].script, folderPath, selItem.parent, selItem.label);
            filesRW.writeInfo(selected, folderPath, type, [selItem.label]);
            treeObj.refresh(dataObj);
        }
        return;
    }
    selected[type].name = selItem.label;
    answer = await vscode.window.showInformationMessage(`Do you want to get the ${selItem.label} ${messageText[type]} from the Siebel database?`, "Yes", "Only method names", "No");
    if (answer === "Yes") {
        dataObj[selItem.label].onDisk = true;
        dataObj[selItem.label].scripts = await dataService.getServerScripts(selected, type);
        for ([scrName, scrMethod] of Object.entries(dataObj[selItem.label].scripts)) {
            filesRW.writeFiles(scrMethod.script, folderPath, selItem.label, scrName);
            scrNames.push(scrName);
        }
        filesRW.writeInfo(selected, folderPath, type, scrNames);
        treeObj.refresh(dataObj);
    }
    if (answer === "Only method names") {
        dataObj[selItem.label].scripts = await dataService.getServerScripts(selected, type, ONLY_METHOD_NAMES);
        treeObj.refresh(dataObj);
    }
}

//creates tree data
class TreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(dataObj) {
        this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, dataObj[bs].onDisk, dataObj[bs].scripts));
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element === undefined) {
            return this.data;
        }
        return Object.keys(element.scripts).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.None, element.scripts[bs].onDisk, false, element.label));
    }
    refresh(dataObj) {
        this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, dataObj[bs].onDisk, dataObj[bs].scripts));
        this._onDidChangeTreeData.fire();
    }
}
//creates the tree items for tree data
class TreeItem extends vscode.TreeItem {
    constructor(label, collabsibleState, onDisk, scripts, parent) {
        super(label, collabsibleState);
        if (scripts) {
            this.scripts = scripts;
        } else {
            this.parent = parent;
        }
        if (onDisk === true) {
            this.iconPath = {
                light: path.join(__filename, "..", "..", "media", "checkmark.svg"),
                dark: path.join(__filename, "..", "..", "media", "checkmark.svg")
            }
        }

    }
}

exports.selectionChange = selectionChange;
exports.TreeDataProvider = TreeDataProvider;