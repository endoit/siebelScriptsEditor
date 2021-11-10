const vscode = require('vscode');

class TreeDataProvider {
    constructor(bsData) {
        this.data = Object.keys(bsData).map((bs) => new TreeItem(bs));
    }
    getTreeItem(element){
        return element;
    }
    getChildren(element) {
        if (element === undefined){
        return this.data;
        }
        return element.children;
    }
}
  
class TreeItem extends vscode.TreeItem {
    constructor(label){
        super(label)
    }
}

exports.TreeDataProvider = TreeDataProvider;