/* eslint-disable global-require, no-unused-expressions */
'use strict'

// Core
const path = require('path')

// Vendor
const expect = require('chai').expect

// Local
const loadConfig = require('./index')

// Constants
const kTestRootPath = path.resolve('.', 'test-data')

// --------------------------------------------------------
describe('node-config-loader', function() {
	beforeEach(() => {
		Reflect.deleteProperty(process.env, 'NODE_ENV')
	})

	it('non-existent config directory throws error', function() {
		expect(function() {
			loadConfig(null, 'directory-that-does-not-exist')
		}).throw(Error)
	})

	it('empty directory returns empty object', function() {
		let result = loadConfig(null, {
			configDirectory: path.join(kTestRootPath, 'empty')
		})
		expect(result).eql({})
	})

	it('empty index.js and empty logging.js returns {logging: {}}', function() {
		let result = loadConfig(null, {
			configDirectory: path.join(kTestRootPath, 'empty-files')
		})
		expect(result).eql({
			logging: {}
		})
	})

	it('throws error if invalid javascript', function() {
		expect(function() {
			loadConfig(null, {
				configDirectory: path.join(kTestRootPath, 'invalid')
			})
		}).throw(Error)
	})

	it('no-index file, logging.js file, dummy, and dummy.js folder', function() {
		let result = loadConfig(null, {
			configDirectory: path.join(kTestRootPath, 'simple.no-index')
		})
		expect(result).eql({
			logging: require(path.join(kTestRootPath, 'simple.no-index', 'logging'))
		})
	})

	it('solely index.js file', function() {
		let result = loadConfig({}, {
			configDirectory: path.join(kTestRootPath, 'simple.index')
		})
		expect(result).eql(require(path.join(kTestRootPath, 'simple.index')))
	})

	it('simple function exports mixed with object exports', function() {
		let result = loadConfig({}, {
			configDirectory: path.join(kTestRootPath, 'simple.functions')
		})
		expect(result).eql({
			name: 'node-config-loader',
			args: [
				path.resolve('.')
			],
			logging: {
				enabled: true,
				args: [
					path.resolve('.')
				]
			},
			email: {
				enabled: false
			}
		})
	})

	it('specific config files override index settings', function() {
		let result = loadConfig({}, {
			configDirectory: path.join(kTestRootPath, 'simple.overrides')
		})
		expect(result).eql({
			logging: {
				enabled: false
			}
		})
	})

	it('default node_env is develop', function() {
		let result = loadConfig({}, {
			configDirectory: path.join(kTestRootPath, 'default.environment')
		})
		expect(result).eql({
			file: 'develop/index.js'
		})
	})

	it('NODE_ENV=staging reads in staging folder config', function() {
		process.env.NODE_ENV = 'staging'
		let result = loadConfig({}, {
			configDirectory: path.join(kTestRootPath, 'simple.environment')
		})
		expect(result).eql({
			name: 'node-config-loader',
			logging: {
				enabled: false,
				file: 'staging'
			},
			email: {
				enabled: false
			}
		})
	})

	it('local overrides NODE_ENV', function() {
		process.env.NODE_ENV = 'staging'
		let result = loadConfig({}, {
			configDirectory: path.join(kTestRootPath, 'local.overrides')
		})
		expect(result).eql({
			file: 'local/index.js'
		})
	})

	describe('database url', function() {
		beforeEach(() => {
			Reflect.deleteProperty(process.env, 'DATABASE_URL')
			Reflect.deleteProperty(process.env, 'SPECIAL_URL')
		})

		it('exports the default database url environment key', function() {
			expect(loadConfig.kDefaultDatabaseUrlEnvKey).a('string')
			expect(loadConfig.kDefaultDatabaseUrlEnvKey).not.empty
		})

		it('exports the default database key', function() {
			expect(loadConfig.kDefaultDatabaseKey).a('string')
			expect(loadConfig.kDefaultDatabaseKey).not.empty
		})

		it('throws error if invalid database url', function() {
			expect(function() {
				process.env.DATABASE_URL = 'some-invalid-string'
				loadConfig()
			}).throw(Error)
		})

		it('parses database url and assigns to default key', function() {
			process.env.DATABASE_URL = 'postgres://johndoe:secret@some-host:1234/his-database'
			let result = loadConfig(null, {
				configDirectory: path.join(kTestRootPath, 'empty')
			})
			expect(result).eql({
				[loadConfig.kDefaultDatabaseKey]: {
					dialect: 'postgres',
					user: 'johndoe',
					password: 'secret',
					host: 'some-host',
					port: '1234',
					name: 'his-database'
				}
			})
		})

		it('parses database url and assigns to default key from SPECIAL_URL', function() {
			process.env.DATABASE_URL = 'something-else'
			process.env.SPECIAL_URL = 'postgres://johndoe:secret@some-host:1234/his-database'
			let result = loadConfig(null, {
				configDirectory: path.join(kTestRootPath, 'empty'),
				databaseUrlEnvKey: 'SPECIAL_URL',
				databaseKey: 'db'
			})
			expect(result).eql({
				db: {
					dialect: 'postgres',
					user: 'johndoe',
					password: 'secret',
					host: 'some-host',
					port: '1234',
					name: 'his-database'
				}
			})
		})

		it('overrides all other settings', function() {
			process.env.DATABASE_URL = 'postgres://johndoe:secret@some-host:1234/his-database'
			let result = loadConfig(null, {
				configDirectory: path.join(kTestRootPath, 'database_url'),
				databaseKey: 'database'
			})
			expect(result).eql({
				database: {
					dialect: 'postgres',
					user: 'johndoe',
					password: 'secret',
					host: 'some-host',
					port: '1234',
					name: 'his-database'
				}
			})
		})
	})
})
