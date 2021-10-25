#!/usr/bin/env node
/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const version = 'v' + require('./package.json').version;
const Logger = require('./lib/logger');

const logger = Logger.getLogger('fabric-shim/cli');


const main = async () => {
    const results = await require('yargs')
        .parserConfiguration({ 'dot-notation': false })
        .commandDir('./lib/cmds')
        .demandCommand()
        .help()
        .wrap(null)
        .alias('v', 'version')
        .version(version)
        .describe('v', 'show version information')
        .env('CORE')
        .argv;

    if (typeof (results.thePromise) !== 'undefined') {
        results.thePromise.then(() => {
            logger.info("Bootstrap process completed")
        }).catch((error) => {
            logger.info(error + '\nCommand failed\n');
            process.exit(1);
        });
    } else {
        process.exit(0);
    }

}

main();
