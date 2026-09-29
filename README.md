Siebel Script And Web Template Editor is a Visual Studio Code extension, which enables editing Siebel object server scripts and web templates directly in VS Code, using the Siebel REST API.

[__See the full documentation for detailed installation and usage instructions__](https://github.com/endoit/siebelScriptsEditor/wiki)

[Changelog](CHANGELOG.md)

# 1. Features

- Download Business Service, Business Component, Applet, Application server scripts and Web Templates from a specified Siebel workspace, and edit them with Visual Studio Code; scripts can be stored as JavaScript, TypeScript, or eScript files, and web templates as HTML files

  ![Get server scripts](https://raw.githubusercontent.com/endoit/siebelScriptsEditor/main/features/getdata.gif "Get server scripts")

- Edit, compare and create new scripts

  ![Edit, compare and create new server scripts](https://raw.githubusercontent.com/endoit/siebelScriptsEditor/refs/heads/main/features/editcomparecreate.gif "Edit, compare and create new server scripts")

- Type definitions are included for Siebel eScript autocompletion and semantic checking

  > **Note:** Siebel eScript has its own semantics, which neither JavaScript nor TypeScript represents completely. When using the dedicated `.escript` file type, the optional [Siebel eScript extension](https://marketplace.visualstudio.com/items?itemName=TitanSystems-DE.siebel-escript) provides matching syntax support in Visual Studio Code.

  ![Autocompletion](https://raw.githubusercontent.com/endoit/siebelScriptsEditor/main/features/snippetgif.gif "Autocompletion")

# 2. Requirements

- Siebel REST API and workspaces should be enabled
