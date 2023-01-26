'use strict';

const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const config = require('../webpack.config.base');
const merge = require('merge-options');

/**@type {import('webpack').Configuration}*/
const partialConfig = {
    context: path.join(__dirname),
    entry: {
        extension: './src/extension.ts',
    },
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'extension.js'
    },
    resolve: {
        plugins: [new TsconfigPathsPlugin({ configFile: path.resolve(__dirname, 'tsconfig.build.json') })]
    }
};
module.exports = merge(config, partialConfig);