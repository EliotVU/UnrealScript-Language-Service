# UnrealScript

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/EliotVU.uc)](https://marketplace.visualstudio.com/items?itemName=EliotVU.uc)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/last-updated/EliotVU.uc)](https://marketplace.visualstudio.com/items?itemName=EliotVU.uc)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/d/EliotVU.uc)](https://marketplace.visualstudio.com/items?itemName=EliotVU.uc)

## Features

This is a work-in-progress extension for Visual Studio Code, its goal is to bring a rich editing experience to UnrealScript, the Unreal Engine's domain specific language.

So far the extension has implemented support for the following features:

* Semantic Syntax Highlighting
* Document Symbol Highlighting (Write, Read)
* Go to Definition, Peek Definition
* Context Auto-Completion
* Code-Actions
  * Create class
  * Inline constant
* Diagnostics (linting)

### Quick Info

![PNG](./docs/media/quickinfo.png)

### Find All References

Enable `Index All Documents` to find references for the entire workspace.

![GIF](./docs/media/references.gif)

### Symbol Renaming

Enable `Index All Documents` to rename symbols for the entire workspace.

![GIF](./docs/media/renaming.gif)

### Symbol Searching

Enable `Index All Documents` to search symbols for the entire workspace.

![PNG](./docs/media/workspaceSymbols.png)

## Advice

For the best results it is advised to work from within a `workspace` and to add all the project dependencies to the workspace, such as the root path for `Core/Classes` and `Engine/Classes`
And even better, add the scripts `.u` and `.upk` content folders to the `workspace` this will make the extension aware of such packages in indexing and auto completion (but not its contents yet)

## Contribution

Yes! For more information regarding contribution, please check the [Contributing Guidelines](./.github/CONTRIBUTING.md).

[![Gitter](https://img.shields.io/gitter/room/unrealscript/Language-Service?color=9cf)](https://gitter.im/unrealscript/Language-Service)
[![Give something back!](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/eliotvu)
