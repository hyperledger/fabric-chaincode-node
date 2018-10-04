#!/usr/bin/env node
const version = 'v'+require('./package.json').version;

require('yargs')
	.commandDir('./lib/cmds')
	.demandCommand()
	.help()
	.wrap(null)
	.alias('v', 'version')
	.version(version)
	.describe('v', 'show version information')
	.env('CORE')
	.argv;