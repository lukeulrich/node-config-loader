'use strict'

// Vendor
const expect = require('chai').expect

// Local
const loadConfig = require('../../index')

describe('node-config-loader', function() {
	it('ignores re-loading index from current directory', function() {
		let config = {
			logging: {
				enabled: false
			}
		}

		let result = loadConfig(__dirname, config)
		expect(result).eql({
			logging: {
				enabled: true
			},
			email: true
		})
	})
})
