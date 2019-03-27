/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const Generate = require ('./lib/generate.js');

'use strict';

module.exports.command = 'generate [options]';
module.exports.desc = 'Generate a file containing the metadata from the deployed contract';
module.exports.builder = (yargs) => {
    yargs.options({
        'file': {alias: 'f', required: true, describe: 'The file name/path to save the generated metadata file', type: 'string'},
        'module-path': {alias: 'p', required: false, describe: 'The path to the directory of your smart contract project which contains your chaincode, default is your current working directory', type: 'string', default: process.cwd()}
    });
    yargs.usage('fabric-chaincode-node metadata generate --file "fileName"');

    return yargs;
};

module.exports.handler = (argv) => {
    argv.thePromise = Generate.handler(argv);
    return argv;
};
