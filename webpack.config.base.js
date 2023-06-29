'use strict';

/**@type {import('webpack').Configuration}*/
const config = {
    target: 'node',
    output: {
        filename: '[name].js',
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    optimization: {
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor',
                    chunks: 'all',
                },
            },
        },
    },
    devtool: process.env.NODE_ENV === 'development'
        ? 'inline-source-map'
        : false,
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
                // exclude: /node_modules/,
                loader: 'ts-loader',
                options: {
                    onlyCompileBundledFiles: true,
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
