# Siebel Script Editor Visual Studio Code Extension Documentation

## Introduction
Siebel Script Editor is a Visual Studio Code extension, which enables the editing of Siebel object server scripts directly in Visual Studio Code, by connecting to the Siebel database.

## Installation
Prerequisites:
- siebelscripteditor-\<VERSION_NUMBER\>.vsix extension file [__Download Link__](https://github.com/endoit/siebelScriptsEditor/raw/main/siebelscripteditor-1.0.0.vsix)
-	Visual Studio Code should be up-to-date
-	[64-bit Oracle Client](https://www.oracle.com/database/technologies/instant-client/downloads.html)

The extension can be installed with the following command using the .vsix file:
```
code --install-extension <PATH>\siebelscripteditor-1.0.0.vsix
```
After successful install, Visual Studio Code should be restarted, and a new icon will appear in the left sidebar:

![icon](/features/documentation/icon.PNG)

In the explorer, one workspace folder should be present, which will be used by the extension to store the scripts:

![wsfolder](/features/documentation/ws.png)

## Configuration
After clicking on the extension icon, a pop-up window will tell you that you do not have any database configurations:

![wsfolder](/features/documentation/nodbconf.PNG)

By clicking on Yes, you will be navigated to the settings:

![settings](/features/documentation/settings.PNG)

Currently there are three settings for the extension:
- __Database Configurations__: used for connecting to the Siebel databases. The structure of the configuration string is the following: DatabaseName/Username/Password@ConnectionString@SiebelUsername
  - DatabaseName: unique, custom name to refer to the database in the extension
  - Username: database username
  - Password: database password
  - ConnectionString: connection string for the database. e.g. 111.111.111.111:1111/SIEBEL
  - SiebelUsername: only required for safe mode, which is enabled by default
- __Default Connection__: the default database/repository/workspace to use when starting the extension, it should be set with the __Set as default__ button on the extension.
- __Safe Mode__: turns safe mode on and off. In safe mode, you can only get and update Siebel objects locked by the given Siebel username if workspaces are not in use or not exist (in case of older Siebel versions). If workspaces are in use, then only objects belonging to active workspaces (their status is either Edit-In-Progress or Checkpointed) created by the given username can be pulled from or pushed to the database.

We should give at least one database configuration, e.g.:

![dbconf](/features/documentation/dbconf.PNG)

After that, Test database connection button on the extension should be used:

![testcon](/features/documentation/testcon.PNG)

If the connection was established, the following message will be shown:

![dbconok](/features/documentation/dbconok.PNG)

Then the reload button will be enabled, and the extension should be reloaded:

![dbconreload](/features/documentation/dbconreload.PNG)

If the connection was unsuccessful, the error will be shown in a pop-up window:

![dbconnotok](/features/documentation/dbconnotok.PNG)

After changing any settings, the extension should be reloaded with the Reload button.

## Overview of the user interface
After reload, the user interface of the extension will be visible. The extension consists of five different boxviews, the uppermost selects the datasource:

![selectds](/features/documentation/selectds.PNG)

The other four shows Siebel objects (Business Services, Business Components, Applets and Applications) and their respective server scripts. First, the database, then the repository, and finally, the workspace has to be chosen. If the used Siebel version does not support workspaces, or workspaces are not enabled, the extension will detect it automatically, and the workspace selection list will be empty. Other settings include the Has scripts checkbox, if it is checked, only objects which contains server scripts will be retrived from the database. If Newer than datepicker is filled, only objects created after the set date will be retrieved. After clicking Get Siebel Data button, the Business Services, Business Components, Applets and Applications from the database will be visible:

![fullui](/features/documentation/fullui.PNG)

The other buttons:
- __Set as default__ sets the Default Connection setting in the settings, so next time when the extension activates, the database, repository and workspace will be set.
- __Create backup__ button serves for creating backup from server scripts of the current query.
- __Open settings__ opens the Siebel Script Editor settings.
- __Reload__ reloads the extension.

## Using the extension to get server scripts
Clicking on an object, a dialog box will show in the bottom right corner with three buttons:

![getbspopup](/features/documentation/getbspopup.PNG)

- __Yes__ will get all the server scripts for the object.
- __Only method names__ gets only the method names, which can be downloaded individually.
- __No__ closes the dialog.

After getting a script or all scripts for the given object, it will be downloaded into the first VSCode workspace folder (only one should be open) in the following structure: DatabaseName_RepositoryName\WorkspaceName (if there area workspaces)\ObjectType\ObjectName:

![getscripts](/features/documentation/getscripts.PNG)

In the extension, a checkmark will appear before the name of an object if at least one method from the object had been downloaded, and checkmarks indicate which individual methods are on the disk:

![checkmark](/features/documentation/checkmark.PNG)

The scripts are saved as javascripts files, and an info.json will be created for each object, which has the database name, repository name and id, workspace name and id if used, and row ids of the siebel object and scripts. For the individual scripts, the last update from and last push to the database timestamp is stored in these info.jsons:

![infojson](/features/documentation/infojson.PNG)

## Refreshing and updating scripts
Two command button will appear in top right corner, the arrow pointing down refreshes the currently focused script from the database, the arrow pointing up pushes it to the database, timestamping the updated column as well:

![pushpullbutton](/features/documentation/pushpullbutton.PNG)

For both actions, confirmation pop-ups will be shown:

![pull](/features/documentation/pull.PNG)

![push](/features/documentation/push.PNG)

If the push was successful, the following message will be shown:

![pushsucc](/features/documentation/pushsucc.PNG)

And the info.json will be updated as well:

![infoup](/features/documentation/infoup.PNG)

Possible errors when pushing scripts to the database:

![perr1](/features/documentation/perr1.PNG)

![perr2](/features/documentation/perr2.PNG)

![perr3](/features/documentation/perr3.PNG)

## Creating backups
The Create backup button downloads all objects and their respective scripts from the current query after confirmation:

![backupq](/features/documentation/backupq.PNG)

The backup is done after the busy marker disappears: 

![crbck](/features/documentation/crbck.PNG)

The backup will be saved into the VSCode workspace folder with a timestamp in the following structure: DatabaseName_RepositoryName\WorkspaceName_backup_timestamp:

![bckst](/features/documentation/bckst.PNG)

The backupinfo.json will be created as well:

![bckinf](/features/documentation/bckinf.PNG)
