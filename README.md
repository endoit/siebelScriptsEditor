# Siebel Script Editor README

Siebel Script Editor is an extension which enables editing server scripts written in eScript for Siebel Objects directly in Visual Studio Code by connecting to the Siebel database.

## Features

Download Business Service, Business Component, Applet and Application server scripts from the specified database, repository and workspace, and edit them with Visual Studio Code as javascript files. Supports Siebel versions older than IP17 as well, which do not have workspaces. 

![Get server scripts](/features/getscripts.gif "Get server scripts")

The downloaded scripts can be refreshed from the Siebel database, or pushed into the Siebel database.

![Push and pull server scripts](/features/pushpull.gif "Push and pull server scripts")

Create backup from the specified database/repository/workspace:

![Backup](/features/backup.gif "Backup")

Snippets included for boilerplate:

![Snippet in action](/features/snippetgif.gif "Snippet in action")

Folder structure for the scripts:
```
Visual Studio Code Workspace   
│
└───Database Name_Repository Name
│   └───Workspace Name
│   │   └───sevice
│   │   │   └───Business Service Name
│   │   │       │   Service_PreInvokeMethod.js
│   │   │       │   CustomMethod.js
│   │   │       │   info.json
│   │   └───buscomp
│   │   │   └───Business Component Name
│   │   │       │   Buscomp_PreInvokeMethod.js
│   │   │       │   CustomMethod.js
│   │   │       │   info.json
│   │   └───applet
│   │   │   └──Applet Name
│   │   │       │   WebApplet_PreInvokeMethod.js
│   │   │       │   CustomMethod.js
│   │   │       │   info.json
│   │   └───application
│   │   │   └───Siebel Application Name
│   │   │       │   CustomMethod.js
│   │   │       │   info.json
│   │   └───Workspace Name_backup_timestamp
│   │       │   │   backupinfo.json
│   │       └───sevice
│   │       └───buscomp
│   │       └───applet
│   │       └───application
│   └───Other Workspace Name
└───Other Database Name_Other Repository Name
    └───Another Workspace Name
```

The info.json holds the information for the Siebel Object server scripts, including the row ids needed for the database operations, and the timestamp of the last update from and last push to the database.

## Requirements

The extension requires 64-bit Oracle Client to be installed, see https://oracle.github.io/node-oracledb/INSTALL.html.

## Extension Settings

This extension contributes the following settings:

* `siebelScriptEditor.databaseConfigurations`: list of database configurations for the extension to connect to databases.
* `siebelScriptEditor.defaultConnection`: default connection, repository and workspace to use when the extension activates, optional.

## Known Issues

The extension currently only works with Oracle databases.
Only one workspace folder is supported.

## Release Notes

### 1.0.0

Initial release of Siebel Scripts Editor