const vscode = require('vscode');
const path = require('path');

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
        return Object.keys(element.scripts).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.None, element.scripts[bs].onDisk));
    }

    refresh(dataObj){
        this.data = Object.keys(dataObj).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, dataObj[bs].onDisk, dataObj[bs].scripts));
        this._onDidChangeTreeData.fire();
    }
}
  
class TreeItem extends vscode.TreeItem {
    constructor(label, collabsibleState, onDisk, scripts, iconPath){ 
        super(label, collabsibleState, iconPath);
        if (scripts){this.scripts = scripts};
        if (onDisk === true){
            this.iconPath = {
                light: path.join(__filename, "..", "..", "media", "checkmark.svg"), 
                dark: path.join(__filename, "..", "..", "media", "checkmark.svg")}
            } 
        
    }
}

exports.TreeDataProvider = TreeDataProvider;