/* eslint-disable global-require */
'use strict'

// Core
const fs = require('fs'),
	path = require('path')

// Vendor
const merge = require('lodash.merge')

// Constants
const kDefaultDatabaseUrlEnvKey = 'DATABASE_URL',
	kDefaultDatabaseKey = 'database'

/**
 * @param {String} configDirectory - base config directory containing configuration files and subdirectories
 * @param {Object} [config = {}] - common configuration regardless of environment (may be overridden by other files)
 * @param {Object} [options = {}]
 * @param {Boolean} [options.includeRootIndex = false] - if true will also load ${configDirectory}/index.js if one exists; false otherwise
 * @param {String} [options.databaseUrlEnvKey = 'DATABASE_URL']
 * @param {String} [options.databaseKey = 'database'] - key to set in config when parsing process.env[options.databaseEnvKey]
 * @returns {Object}
 */
module.exports = function(configDirectory, config = {}, options = {}) {
	if (!isDirectory(configDirectory))
		throw new Error(`${configDirectory} is not a valid directory`)

	// Initialize defaults
	if (!config)
		config = {} // eslint-disable-line no-param-reassign
	if (!options.databaseUrlEnvKey)
		options.databaseUrlEnvKey = kDefaultDatabaseUrlEnvKey
	if (!options.databaseKey)
		options.databaseKey = kDefaultDatabaseKey
	options.includeRootIndex = !!options.includeRootIndex

	// Load base configuration
	mergeConfigFiles(config, configDirectory, options.includeRootIndex)

	/**
	 * Load environment configuration
	 *
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
	 * Finally, if the database configuration is set via the environment variable, DATABASE_URL, or
	 * whichever one is passed in the options, that takes precedence over any file configuration.
	 */
	let environmentName = process.env.NODE_ENV || 'develop',
		environmentConfigDirectory = path.resolve(configDirectory, environmentName)

	mergeConfigFiles(config, environmentConfigDirectory)

	// Load local overrides - if NODE_ENV is set to 'local', these will get processed 2x (operator
	// error)
	let localConfigDirectory = path.resolve(configDirectory, 'local')
	mergeConfigFiles(config, localConfigDirectory)

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
/**
 * @param {Object} config - base configuration to be extended with the configuration files in ${directory}
 * @param {String} directory - directory to search for configuration files
 * @param {Boolean} [includeIndexFile = true]
 */
function mergeConfigFiles(config, directory, includeIndexFile = true) {
	getConfigFileNames(directory, includeIndexFile)
	.forEach((configFile) => {
		let moreConfig = require(configFile)
		if (typeof moreConfig === 'function')
			moreConfig = moreConfig()

		let baseName = path.basename(configFile, '.js')
		if (baseName !== 'index') {
			if (!config[baseName])
				config[baseName] = moreConfig
			else
				merge(config[baseName], moreConfig)
		}
		else {
			merge(config, moreConfig)
		}
	})
}

/**
 * @param {String} directory - directory to search for configuration files
 * @param {Boolean} includeIndexFile
 * @returns {Array.<String>} - absolute paths to configuration files in ${directory}
 */
function getConfigFileNames(directory, includeIndexFile) {
	if (!isDirectory(directory))
		return []

	let foundIndexFile = false,
		result = fs.readdirSync(directory)
	.filter((configFileName) => {
		// Even if ${includeIndexFile} is true, do not include it here. We want it to be loaded
		// before the other files, thus it is added to result in a later step.
		if (configFileName === 'index.js') {
			foundIndexFile = true
			return false
		}

		if (!configFileName.endsWith('.js'))
			return false

		let resolvedPath = path.resolve(directory, configFileName),
			stat = fs.statSync(resolvedPath)
		return stat.isFile()
	})
	.map((fileName) => path.resolve(directory, fileName))

	if (foundIndexFile && includeIndexFile)
		// Process any index.js file *before* the other files
		result.unshift(path.resolve(directory, 'index.js'))

	return result
}

/**
 * @param {String} directory
 * @returns {Boolean} - true if ${directory} exists and is a directory; false otherwise
 */
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

/**
 * @param {String} databaseUrl
 * @returns {Object|false} - if successfully parsed the DATABASE_URL, returns an Object with the relevant information; false otherwise
 */
function parseDatabaseUrl(databaseUrl) {
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
