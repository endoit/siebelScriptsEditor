# Siebel Script Editor README

Siebel Script Editor is an extension which enables editing server scripts for Siebel Objects directly in Visual Studio Code by connecting to the Siebel database.

## Features

Download Business Service, Business Component, Applet and Application server scripts from the specified database, repository and workspace, and edit them with Visual Studio Code as javascript files.
Create full backup from the specified database/repository/workspace.
Option to search only for objects which have scripts or newer than specified.
The downloaded scripts can be easily versioned using git, refreshed from the Siebel database, or pushed into the Siebel database.

![Screenshot of the Siebel Script Editor](/features/extimg.png "Siebel Script Editor GUI")

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

The info.json holds the information for the Siebel Object server scripts, including the row ids needed for the database operations, and the timestamp of the last update from the database or last push to the database.

## Requirements

The extension requires the Oracle Instant Client to be installed, see https://oracle.github.io/node-oracledb/INSTALL.html.

## Extension Settings

This extension contributes the following settings:

* `siebelScriptEditor.databaseConfigurations`: list of database configurations for the extension to connect to databases
* `siebelScriptEditor.defaultConnection`: default connection, repository and workspace to use when the extension activates, optional

## Known Issues

The extension currently only works with Oracle databases.
Only one workspace folder is supported.
Only works with newer (from IP 2017) Siebel versions, which has workspaces.

## Release Notes

### 1.0.0

Initial release of Siebel Scripts Editor