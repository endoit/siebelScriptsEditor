const vscode = require("vscode");
const path = require("path");
const dataService = require("./dataService.js");
const filesRW = require("./filesRW.js");

const messageText = {
    service: "business service",
    buscomp: "business component",
    applet: "applet",
    application: "application",
    webtemp: "web template"
}

//handle selection in the tree views
const selectionChange = async ({ selection: [selItem] }, type, selected, dataObj, treeObj) => {
    const folderPath = `${selected.connection}/${selected.workspace}/${type}`;
    const ONLY_METHOD_NAMES = true;
    const IS_WEBTEMP = true;
    let answer;
    let scrName;
    let scrMethod;
    let scrNames = [];

    if (type === "webtemp") {
        selected[type].name = selItem.label;
        answer = await vscode.window.showInformationMessage(`Do you want to get the ${selItem.label} ${messageText[type]} definition from Siebel?`, "Yes", "No");
        if (answer === "Yes") {
            dataObj[selItem.label].definition = await dataService.getWebTemplate(selected);
            dataObj[selItem.label].onDisk = true;
            filesRW.writeFiles(dataObj[selItem.label].definition, folderPath, selItem.label);
            filesRW.writeInfo(selected, folderPath, type, selItem.label);
            treeObj.refresh(dataObj, IS_WEBTEMP);
        }
        return;
    }
    if (selItem.hasOwnProperty("scripts") === false) {
        selected[type].name = selItem.parent;
        selected[type].childName = selItem.label;
        answer = await vscode.window.showInformationMessage(`Do you want to get the ${selItem.label} ${messageText[type]} method from Siebel?`, "Yes", "No");
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
    answer = await vscode.window.showInformationMessage(`Do you want to get the ${selItem.label} ${messageText[type]} from Siebel?`, "Yes", "Only method names", "No");
    if (answer === "Yes") {
        dataObj[selItem.label].onDisk = true;
        dataObj[selItem.label].scripts = await dataService.getServerScripts(selected, type);
        for ([scrName, scrMethod] of Object.entries(dataObj[selItem.label].scripts)) {
            filesRW.writeFiles(scrMethod.script, folderPath, selItem.label, scrName);
            scrNames.push(scrName);
        }
        filesRW.writeInfo(selected, folderPath, type, scrNames);
        treeObj.refresh(dataObj);
        return;
    }
    if (answer === "Only method names") {
        dataObj[selItem.label].scripts = await dataService.getServerScripts(selected, type, ONLY_METHOD_NAMES);
        treeObj.refresh(dataObj);
        return;
    }
}

//creates tree data
class TreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(dataObj, isWebTemplate = false) {
        if (isWebTemplate){
            this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.None, {onDisk: dataObj[bs].onDisk, definition: dataObj[bs].definition}));
        } else {
            this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, {onDisk: dataObj[bs].onDisk, scripts: dataObj[bs].scripts}));
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element === undefined) {
            return this.data;
        }
        return Object.keys(element.scripts).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.None, {onDisk: element.scripts[bs].onDisk, scripts: false, parent: element.label}));
    }
    refresh(dataObj, isWebTemplate) {
        if (isWebTemplate){
            this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.None, {onDisk: dataObj[bs].onDisk, definition: dataObj[bs].definition}));
        } else {
            this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, {onDisk: dataObj[bs].onDisk, scripts: dataObj[bs].scripts}));
        }
        this._onDidChangeTreeData.fire();
    }
}
//creates the tree items for tree data
class TreeItem extends vscode.TreeItem {
    constructor(label, collabsibleState, {onDisk, scripts, parent, definition}) {
        super(label, collabsibleState);
        if (scripts) {
            this.scripts = scripts;
        } else if (parent !== undefined){
            this.parent = parent;
        } else if (definition !== undefined){
            this.definition = definition;
        }
        if (onDisk === true) {
            this.iconPath = {
                light: path.join(__filename, "..", "..", "media", "checkmark.png"),
                dark: path.join(__filename, "..", "..", "media", "checkmark.png")
            }
        }

    }
}

exports.selectionChange = selectionChange;
exports.TreeDataProvider = TreeDataProvider;