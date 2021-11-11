const vscode = require('vscode');
const path = require('path');

class TreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(bsData) {
        this.data = Object.keys(bsData).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed));    
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

    refresh(bsData){
        this.data = Object.keys(bsData).map((bs) => new TreeItem(bs, vscode.TreeItemCollapsibleState.Collapsed, bsData[bs].onDisk));
        this._onDidChangeTreeData.fire();
    }
}
  
class TreeItem extends vscode.TreeItem {
    constructor(label, collabsibleState, onDisk, iconPath){ 
        super(label, collabsibleState, iconPath);
        if (onDisk === true){
            this.iconPath = {
                light: path.join(__filename, "..", "..", "media", "checkmark.svg"), 
                dark: path.join(__filename, "..", "..", "media", "checkmark.svg")}
            } 
        
    }
}

exports.TreeDataProvider = TreeDataProvider;