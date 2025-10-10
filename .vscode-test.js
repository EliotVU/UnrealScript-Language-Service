const { defineConfig } = require('@vscode/test-cli');

// We don't have any compiled tests, yet.
module.exports = defineConfig({ files: 'out/test/**/*.test.js' });
