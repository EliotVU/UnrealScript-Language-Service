# Contributing

The UnrealScript Language Service is an extension for VSCode powered by our own Language Service Provider adding support for the UnrealScript language.

We'd greatly appreciate any contributions such as the following, but not limited to: new linting rules, bug fixes, custom UnrealScript features support, new code actions, among new possible features that we don't have yet, such as formatting.

## How to build

1. Clone this repository.
2. Ensure you have the latest [NodeJS 18](https://nodejs.org/en/download)
3. Run `npm install` in the root directory of the cloned repository (where the package.json is located)
4. Open the root directory in Visual Studio Code.
5. Launch the task `Launch Client` (shortcut **F5**)
6. If all went right, a new instanced window of Visual Studio Code should appear and be running the extension.
7. After making any changes, press (CTRL+Shift+P) and look for "Restart Extension Host" to re-run the extension with the new changes.

## How to test

There are a dozen of unit-tests scattered around the repository, in order to run them you will need to install some additional extensions to VSCode.

1. Install [Test Explorer UI](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer)
2. Install [Mocha Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter)
3. Open the "Testing" panel, click the refresh button or `Ctrl+R`
4. Click "Run Tests"

### Layout

* Tests are scattered around various places, this may seem odd at first glance, but it all makes sense when you look at it from a relative point of view.
* For instance, helper functions are located next to the file that contains the helper functions e.g. `name.test.ts` next to `name.ts`
* Tests that deal with the entire workings of various modules are located under its own directory `test` e.g. `server/src/UC/test` for symbols, categorized by feature or symbol kind.
* `server/test` for tests that deal with the server's features that are not particularly specific to individual UnrealScript features.
* `syntaxes/test` for the tmLanguage syntax unit tests.

### Caveats

* Some tests may fail when running all tests at once (multi-threading), always run the test again to make ensure that it is working correctly.
* Tests may not even show up if there are any TypeScript errors.
* Make sure you import any modules using the relative syntax like `../Symbols` instead of `UC/Symbols` (while this works at run time, the testing suite does not support such paths)

## How to contribute

1. Open a "Pull Request", for this you need to own a fork of this repository.
2. Proceed to describe your changes and your intentions behind these changes.
