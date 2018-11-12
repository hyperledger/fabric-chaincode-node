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
function register(contracts, serializers) {
    shim.start(new ChaincodeFromContract(contracts, serializers));
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
    const JSONSerializer = require('fabric-contract-api').JSONSerializer;
    const defaultSerialization = {
        transaction: 'jsonSerializer',
        serializers: {
            jsonSerializer : JSONSerializer
        }
    };

    if (json.main) {
        logger.debug('Using the main entry %s', json.main);
        const p = (path.resolve(modPath, json.main));
        const r = require(p);

        // setup the set of serializers that can be used
        let serializers;
        if (!r.serializers) {
            serializers = defaultSerialization;
        } else {
            if (!r.serializers.transaction) {
                throw new Error('There should be a \'transaction\' property to define the serializer for use with transactions');
            }
            serializers = r.serializers;

            // copy in the default ones if not already set
            for (const s in defaultSerialization.serializers) {
                serializers.serializers[s] = defaultSerialization.serializers[s];
            }

        }

        // check the contracts and setup thos eup.
        if (r.contracts) {
            register(r.contracts, serializers);
        } else {
            register([r], serializers);
        }
    } else {
        throw new Error('Can not detect any of the indications of how this is a contract instance');
    }
}

module.exports.bootstrap = bootstrap;
module.exports.register = register;


