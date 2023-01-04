# UnrealScript

[![Marketplace Version](https://vsmarketplacebadge.apphb.com/version/EliotVU.uc.svg "Current Release")](https://marketplace.visualstudio.com/items?itemName=EliotVU.uc)
[![Deploy Extension](https://github.com/EliotVU/UnrealScript-Language-Service/actions/workflows/main.yml/badge.svg)](https://github.com/EliotVU/UnrealScript-Language-Service/actions/workflows/main.yml)
[![Gitter](https://badges.gitter.im/unrealscript/Language-Service.svg)](https://gitter.im/unrealscript/Language-Service?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)
[![Give something back!](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/eliotvu)

<img src="https://raw.githubusercontent.com/EliotVU/UnrealScript-Language-Service/master/demo.gif">

## Features

This is a work-in-progress extension for Visual Studio Code, its goal is to bring a rich editing experience to UnrealScript, the Unreal Engine's domain specific language.

So far the extension has implemented support for the following features:

* Semantic Syntax Highlighting
* Diagnostics (linting)
* Symbol Searching
* Symbol Renaming
* Find All References
* Go to Definition, Peek Definition
* Quick Info (hover tooltips)
* Auto-Completion
* Code-Actions (create new class)

## How to build

* Fork and/or clone this repository.
* Open the folder where your cloned repository resides, in Visual Studio Code (Open folder).
* Make sure that you have the latest NodeJS and NPM installed!
* Go to "Run and Debug" or CTRL+Shift+D and select "Launch Extension", or press F5 for short, this should build(and watch) the project and proceed to launch another VSCode window (so called "Extension Host Development") with this repository's extension enabled.
* You can also manually watch for changes by executing the following in a commandline: npm run watch
* You are now free to make modifications, if compiled successfully, go to your "Extension Host Development" instance and press CTRL+R+R to restart the instance.

## Can I contribute?

* Yes! See "How to Build"
* You can open a "Pull Request", for this you need to own a fork of this repository.
* Proceed to describe your changes and your intentions behind these changes.
* Any of the following would be greatly appreciated! Such as new linting rules, bug fixes, custom UnrealScript support, new code actions, among new possible features that we don't have yet, such as formatting.
