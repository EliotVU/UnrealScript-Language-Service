//@ts-check

'use strict';

const path = require('path');

const config = require('../webpack.config');
const merge = require('merge-options');

module.exports = merge(config, {
	context: path.join(__dirname),
	entry: {
		extension: './src/server.ts',
	},
	output: {
		path: path.resolve(__dirname, 'out'),
		filename: 'server.js'
	}
});