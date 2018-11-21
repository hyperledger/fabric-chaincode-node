/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const path = require('path');
const yargs = require('yargs');
const shim = require('../chaincode');
const ChaincodeFromContract = require('./chaincodefromcontract');
const Logger = require('../logger');
const StartCommand = require('../cmds/startCommand.js');

const logger = Logger.getLogger('contracts-spi/bootstrap.js');
/**
 * This provides SPI level functions to 'bootstrap' or 'get the chaincode going'
 * This is achieved through introspection of the package.json that defines the
 * node module
 */

/**
 * @ignore
 * @param {Contract} contracts contract to register to use
 */
function register(contracts) {
    shim.start(new ChaincodeFromContract(contracts));
}

/**
 * This is the main entry point for starting the user's chaincode
 * @ignore
 */
function bootstrap() {
    const opts = StartCommand.getArgs(yargs);

    const modPath = path.resolve(process.cwd(), opts['module-path']);

    const jsonPath = path.resolve(modPath, 'package.json');
    // let's find the package.json file
    const json = require(jsonPath);
    logger.debug('starting up and reading package.json at %s', jsonPath);
    logger.debug(json);
    if (json.main) {
        logger.debug('Using the main entry %s', json.main);
        const p = (path.resolve(modPath, json.main));
        const r = require(p);

        if (r.contracts) {
            register(r.contracts);
        } else {
            register([r]);
        }
    } else {
        throw new Error('Can not detect any of the indications of how this is a contract instance');
    }
}

module.exports.bootstrap = bootstrap;
module.exports.register = register;
