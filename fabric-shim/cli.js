#!/usr/bin/env node
const version = 'v' + require('./package.json').version;
const Logger = require('./lib/logger');

const logger = Logger.getLogger('fabric-shim/cli');

const results = require('yargs')
    .commandDir('./lib/cmds')
    .demandCommand(1, 'Need to specify a command')
    .help()
    .wrap(null)
    .alias('v', 'version')
    .version(version)
    .describe('v', 'show version information')
    .env('CORE')
    .argv;

if (typeof(results.thePromise) !== 'undefined') {
    results.thePromise.then(() => {
        console.log('\nCommand succeeded\n');
    }).catch((error) => {
        logger.error(error);
        console.error(error.stack);
        console.error(error + '\nCommand failed\n');
        process.exit(1);
    });
} else {
    process.exit(0);
}
