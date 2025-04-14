**Changelog**

# v2.1.0 - 2025-04-15

- Changes when the Get Workspaces From The Siebel REST API setting is enabled:
  -  Now supports dynamic integration objects in Siebel versions 23.5 and above, eliminating the need for the Base Workspace integration object (still recommended for performance), [see documentation for more information](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)
  - If no editable workspace is found, the extension falls back to the Workspaces setting of the connection
  - Added a Refresh Workspaces button to the Datasource panel (visible only if the setting is enabled), allowing the manual synchronization of the workspaces with Siebel - helpful when new workspaces were created, their status changed or a connection error occured
  - When choosing a workspace to compare against, all Siebel workspaces are shown
- The push button now is hidden for objects in the MAIN or integration worskapces, as well as for workspaces not created by the user specified in the connection
- The MAIN workspace is now automatically created for each connection and cannot be deleted (for existing connections, adding any workspace will trigger the creation of MAIN if it does not exist already)
- Instead of using a single .compare file, the extension now stores comparison data in separate files based on their extensions (.js, .ts, .html) within a dedicated compare folder
- Minor bug fixes and optimizations

# v2.0.0 - 2024-12-16

- The code was completely refactored and many issues/bugs/typos were fixed
- Added a new action button, Compare, which can compare the downloaded objects with the ones stored in different Siebel workspaces
- Changed the Datasource panel layout, the unnecessary Reload and Set as default buttons were removed, the Open Settings was relocated to the top right corner along with two new buttons: New Connection and Edit Connection, which open a GUI to edit the Siebel REST API connections
- The following settings are now deprecated: REST Endpoint Configurations, Workspaces, Default Connection and Get Workspaces From REST, their contents are automatically copied to the new Connections setting, which can be edited through the aforementioned GUI, [see the documentation](https://github.com/endoit/siebelScriptsEditor/wiki) for more information
- Default action when file exists setting was added, which controls the behavior when selecting an already downloaded script or web template from the tree views: open it from disk, overwrite from Siebel or always ask what to do
- Max Page Size setting was added, which controls the number of retrieved records from the Siebel REST API, and documentation was extended for standard Siebel methods, delete the index.d.ts from you workspace folder and restart Visual Studio Code to create an updated file, thanks [DarkenCreature](https://github.com/DarkenCreature) again for these contributions
- Settings now can be modified without reloading the extension, any change in them is reflected immediately
- Changed the icons for the pull/push script actions, now they are not the same as the Next/Previous Change buttons in a difference editor
- The info.json file for downloaded Siebel objects will no longer be created as the extension does not use it
- Further improved the conditions when the action buttons are shown
- Added Collapse All button for the tree views for objects with server scripts
- Documentation was updated to reflect the changes and moved to the wiki tab of the GitHub repository

# v1.4.0 - 2024-01-12

- Three more settings were added, thanks [DarkenCreature](https://github.com/DarkenCreature) for the contribution! Now scripts can be saved as .ts files (as you can use types in eScript similarly to TypeScript), and the fetching behavior can be customized when clicking on a Siebel object in the tree view. For more information, read the [documentation](https://github.com/endoit/siebelScriptsEditor/wiki#21-configuration)
- The push and pull buttons now only appear when the currently opened file is a .js/.ts/.html file

# v1.3.3 - 2023-11-29

- Fixed the color of the pull/push script buttons in light and dark themes
- Updated dependencies
- Minor corrections in the code

# v1.3.1 - 2023-10-11

- Minor fixes in the code and the icons of the push/pull script buttons have been changed

# v1.3.0 - 2022-12-21

- Added debounce for the search field to reduce the amount of requests
- Minor fixes in the code and in the Siebel type definitions, delete the index.d.ts from the workspace folder and reload the extension to create an updated file
- Source code is now in TypeScript

# v1.2.2 - 2022-10-17

- File index.d.ts no longer needs to be opened to use the autocompletion and semantic checking features

# v1.2.0 - 2022-10-13

- Vastly improved autocompletion and semantic checking for the scripts, [see documentation for more information](https://github.com/endoit/siebelScriptsEditor/wiki#3-autocompletion-and-semantic-checking)

# v1.1.0 - 2022-08-11

- New (experimental) setting added: Get Workspaces From REST. If this checkbox is set to true, the workspaces for the connections will be fetched from the Siebel REST API, without manually writing the Workspaces setting. In order for this feature to work, an integration object has to be imported into Siebel, and that workspace should be merged into the primary branch. See documentation for more detailed instructions
- Minor fixes in the code and in the documentation

# v1.0.1 - 2022-08-05

- Repository is now public
- Minor fixes in the documentation

# v1.0.0 - 2022-07-27

- Initial release
