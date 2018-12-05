#!/usr/bin/env node
const version = 'v' + require('./package.json').version;

const results = require('yargs')
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
        console.log('\nCommand succeeded\n');
    }).catch((error) => {
        console.log(error + '\nCommand failed\n');
        process.exit(1);
    });
} else {
    process.exit(0);
}
