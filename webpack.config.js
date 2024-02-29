/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');
const webpack = require('webpack');

/** @type WebpackConfig */
const webExtensionConfig = {
	mode: 'none',
	target: 'node',
	entry: {
		'extension': './src/extension.ts'
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, './dist'),
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../../[resource-path]'
	},
	resolve: {
		mainFields: ['module', 'main'], // look for `browser` entry point in imported node modules
		modules: ['node_modules'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			'assert': require.resolve('assert')
		}
	},
	module: {
		rules: [{
			test: /\.ts$/,
			use: "ts-loader",
			exclude: /node_modules/
		}
		]
		/*rules: [
			{
				test: /\.ts$/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							transpileOnly: true
						}
					}
				]
			}
		]*/
	},
	plugins: [
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1 // disable chunks by default since web extensions must be a single bundle
		})
		/*,
		new webpack.ProvidePlugin({
			process: 'process/browser', // provide a shim for the global `process` variable
		}),*/
	],
	externals: {
		'vscode': 'commonjs vscode' // ignored because it doesn't exist

	},
	performance: {
		hints: false
	},
	devtool: 'nosources-source-map', // create a source map that points to the original source file
	infrastructureLogging: {
		level: "log", // enables logging required for problem matchers
	}
};

module.exports = [webExtensionConfig];