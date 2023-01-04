'use strict';

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node',
    output: {
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    devtool: 'source-map',
    externals: {
        vscode: 'commonjs vscode',
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'ts-loader',
                options: { 
                    configFile: 'tsconfig.build.json',
                    compilerOptions: {
                        // module: 'es6'
                    }
                }
            }
        ]
    }
};
module.exports = config;