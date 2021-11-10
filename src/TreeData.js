const vscode = require('vscode');
const path = require('path');
class TreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    //onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(bsData) {
        this.data = Object.keys(bsData).map((bs) => new TreeItem(bs));
    }
    
    getTreeItem(element){
        return element;
    }

    getChildren(element){
        if (element === undefined){
        return this.data;
        }
        return element.children;
    }

    refresh(){
        console.log("refresh called")
        this._onDidChangeTreeData.fire();
    }
}
  
class TreeItem extends vscode.TreeItem {
    constructor(label, collabsibleState, iconPath){ 
        super(label, collabsibleState, iconPath);
        if (this.label === "UCM List Import Service"){
        this.iconPath = {light: path.join(__filename, "..", "..", "media", "checkmark.svg"), dark: path.join(__filename, "..", "..", "media", "checkmark.svg")}
        }
    }
}

exports.TreeDataProvider = TreeDataProvider;