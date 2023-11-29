**Changelog**

# v1.3.2 - 2023-11-29

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

- Vastly improved autocompletion and semantic checking for the scripts, [see documentation for more information](documentation.md#3-autocompletion-and-semantic-checking)

# v1.1.0 - 2022-08-11

- New (experimental) setting added: Get Workspaces From REST. If this checkbox is set to true, the workspaces for the connections will be fetched from the Siebel REST API, without manually writing the Workspaces setting. In order for this feature to work, an integration object has to be imported into Siebel, and that workspace should be merged into the primary branch. See documentation for more detailed instructions
- Minor fixes in the code and in the documentation

# v1.0.1 - 2022-08-05

- Repository is now public
- Minor fixes in the documentation

# v1.0.0 - 2022-07-27

- Initial release
