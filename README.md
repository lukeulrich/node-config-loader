# node-config-loader
[![Build Status](https://travis-ci.org/lukeulrich/node-config-loader.svg?branch=master)](https://travis-ci.org/lukeulrich/node-config-loader)
[![codecov](https://codecov.io/gh/lukeulrich/node-config-loader/branch/master/graph/badge.svg)](https://codecov.io/gh/lukeulrich/node-config-loader)

Simplifies loading environment specific configuration in a developer friendly approach.

## Usage

Given the following directory structure:

```bash
$ find .
./develop
./develop/index.js
./develop/database.js
./develop/logging.js
./production
./production/database.js
./production/email.js
./index.js
./database.js
./routing.js
```

`index.js`
```javascript
const loadConfig = require('node-config-loader')

// Base configuration
let config = {
	name: 'my-app',
	database: {
		enabled: true
	},
	...
}

// Read all other javascript files in this directory and merge their exports into ${config}. Next,
// merge all javascript files in the subdirectory, ${process.env.NODE_ENV || 'develop'} into
// ${config}. Finally, if __dirname/local exists, similarly merge its configuration files into
// ${config}.
module.exports = loadConfig(__dirname, config)
```

This exports a single configuration object such as the following (assuming NODE_ENV=develop or falsy):

```javascript
{
	name: 'my-app',
	database: {
		enabled: true,
		host: 'localhost',
		...
	},
	routing: {
		...
	},
	logging: {
		...
	}
	// Note how there is no email field since NODE_ENV=develop and this is under the production folder
}
```

## Benefits

* Simpler, better organization of configuration files
* Avoids monolithic, bloated configuration files
* Environment specific configuration
* Local overrides

## How it works

The configuration begins with all properties defined in any `index.js` file. Configuration contained in other files in the same directory is added under the basename of that filename. For example, any exports from `logging.js` will be added under the `logging` key of the resulting configuration.
