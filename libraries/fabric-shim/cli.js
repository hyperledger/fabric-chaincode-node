#!/usr/bin/env node
const version = 'v' + require('./package.json').version;
const Logger = require('./lib/logger');

const logger = Logger.getLogger('fabric-shim/cli');

const results = require('yargs')
    .parserConfiguration({"dot-notation":false})
    .commandDir('./lib/cmds')
    .demandCommand()
    .help()
    .wrap(null)
    .alias('v', 'version')
    .version(version)
    .describe('v', 'show version information')
    .env('CORE')
    .argv;

if (typeof(results.thePromise) !== 'undefined') {
    results.thePromise.then(() => {
        logger.info('\nCommand succeeded\n');
    }).catch((error) => {
        logger.info(error + '\nCommand failed\n');
        process.exit(1);
    });
} else {
    process.exit(0);
}
