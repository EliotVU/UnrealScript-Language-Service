'use strict';

const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const config = require('./webpack.config.base');
const merge = require('merge-options');

/**@type {import('webpack').Configuration}*/
const partialConfig = {
    mode: 'development',
    context: path.join(__dirname),
    entry: {
        extension: './client/src/extension.ts',
        server: './server/src/server.ts',
    },
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: '[name].js'
    },
    resolve: {
        plugins: [
            new TsconfigPathsPlugin({ configFile: 'tsconfig.build.json' }),
        ]
    },
};
module.exports = merge(config, partialConfig);