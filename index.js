/* eslint-disable global-require */
'use strict'

// Core
const fs = require('fs'),
	path = require('path')

// Vendor
const merge = require('lodash.merge')

// Constants
const kBasePath = path.resolve('.'),
	kDefaultDatabaseUrlEnvKey = 'DATABASE_URL',
	kDefaultDatabaseKey = 'database'

/**
 * @param {Object} [config = {}] - common configuration regardless of environment (may be overridden by other files)
 * @param {Object} [options = {}]
 * @param {String} [options.configDirectory = '.'] - base config directory containing configuration files and subdirectories
 * @param {String} [options.databaseUrlEnvKey = 'DATABASE_URL']
 * @param {String} [options.databaseKey = 'database'] - key to set in config when parsing process.env[options.databaseEnvKey]
 * @returns {Object}
 */
module.exports = function(config = {}, options = {}) {
	// Initialize defaults
	if (!config)
		config = {} // eslint-disable-line no-param-reassign
	if (!options.configDirectory)
		options.configDirectory = kBasePath
	if (!options.databaseUrlEnvKey)
		options.databaseUrlEnvKey = kDefaultDatabaseUrlEnvKey
	if (!options.databaseKey)
		options.databaseKey = kDefaultDatabaseKey

	if (!isDirectory(options.configDirectory))
		throw new Error(`${options.configDirectory} is not a valid directory`)

	// Load base configuration
	mergeConfigFiles(config, options.configDirectory)

	// Load environment configuration
	/**
	 * Environment names are based on the NODE_ENV environment variable.
	 *
	 * Recommended names for the environment:
	 * 1. develop (assumed if NODE_ENV is falsy)
	 * 2. boom (unstable build)
	 * 3. staging (evaluation before pushing to production)
	 * 4. production
	 *
	 * Following the recommended names is not required and may be set to whatever names are desired.
	 *
	 * Several configuration files may co-exist side by side and are merged in the following order
	 * (precedence given to the modules loaded later):
	 *
	 * index.js
	 * ${environment name}/index.js
	 * local/index.js (not part of the repository)
	 *
	 * Finally, if any configuration is set via environment variables (e.g. DATABASE_URL),
	 * that takes precedence over any configuration in files.
	 */
	let environmentName = process.env.NODE_ENV || 'develop'

	mergeConfigFiles(config, path.resolve(options.configDirectory, environmentName))

	// Load local overrides
	mergeConfigFiles(config, path.resolve(options.configDirectory, 'local'))

	// Load any database environment configuration
	let databaseUrl = process.env[options.databaseUrlEnvKey]
	if (databaseUrl) {
		let databaseConfigFromUrl = parseDatabaseUrl(databaseUrl)
		if (databaseConfigFromUrl === false)
			throw new Error(`Invalid database environment variable, ${options.databaseUrlEnvKey}: ${databaseUrl}`)

		if (!config[options.databaseKey])
			config[options.databaseKey] = databaseConfigFromUrl
		else
			merge(config[options.databaseKey], databaseConfigFromUrl)
	}

	return config
}

// --------------------------------------------------------
function mergeConfigFiles(config, directory) {
	getConfigFileNames(directory)
	.forEach((configFile) => {
		let baseName = path.basename(configFile, '.js')
		try {
			let moreConfig = require(configFile)
			if (typeof moreConfig === 'function')
				moreConfig = moreConfig(kBasePath)

			if (baseName !== 'index') {
				if (!config[baseName])
					config[baseName] = moreConfig
				else
					merge(config[baseName], moreConfig)
			}
			else {
				merge(config, moreConfig)
			}
		}
		catch (error) {
			if (error.code === 'MODULE_NOT_FOUND')
				return

			// Some other error parsing error occurred, rethrow
			throw error
		}
	})
}

/**
 * @param {String} directory
 * @returns {Array.<String>} - absolute paths to configuration files in ${directory}
 */
function getConfigFileNames(directory) {
	if (!isDirectory(directory))
		return []

	let result = fs.readdirSync(directory)
	.filter((configFileName) => {
		if (configFileName === 'index.js' || !configFileName.endsWith('.js'))
			return false

		let resolvedPath = path.resolve(directory, configFileName),
			stat = fs.statSync(resolvedPath)
		return stat.isFile()
	})
	.map((fileName) => path.resolve(directory, fileName))

	let isConfigSubDirectory = path.resolve(directory) !== kBasePath
	if (isConfigSubDirectory)
		// Process any index.js file *before* the other files
		result.unshift(path.resolve(directory, 'index.js'))

	return result
}

function isDirectory(directory) {
	let stat = null
	try {
		stat = fs.statSync(directory)
	}
	catch (error) {
		// Noop
		return false
	}
	return stat.isDirectory()
}

function parseDatabaseUrl(databaseUrl) {
	if (!databaseUrl)
		return null

	// e.g. dialect://user:password@host:port/name
	//                 1------------| 2------------------------| 3----------------------------------------| 4--|
	// 5------------|
	let matches = databaseUrl.match(/^([^:]+):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
	if (matches) {
		return {
			dialect: matches[1],
			user: matches[2],
			password: matches[3],
			host: matches[4],
			port: matches[5],
			name: matches[6]
		}
	}

	return false
}

// --------------------------------------------------------
// Export defaults for testing and/or globally redefining
module.exports.kDefaultDatabaseUrlEnvKey = kDefaultDatabaseUrlEnvKey
module.exports.kDefaultDatabaseKey = kDefaultDatabaseKey
