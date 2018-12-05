/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const path = require('path');
const yargs = require('yargs');
const Ajv = require('ajv');
const fs = require('fs-extra');

const shim = require('../chaincode');
const ChaincodeFromContract = require('./chaincodefromcontract');
const Logger = require('../logger');
const StartCommand = require('../cmds/startCommand.js');

const logger = Logger.getLogger('contracts-spi/bootstrap.js');

class Bootstrap {
    /**
     * This provides SPI level functions to 'bootstrap' or 'get the chaincode going'
     * This is achieved through introspection of the package.json that defines the
     * node module
     */

    /**
     * @ignore
     * @param {Contract} contracts contract to register to use
     */
    static async register(contracts, serializers) {
        // load up the meta data that the user may have specified
        // this will need to passed in and rationalized with the
        // code as implemented
        const filemetadata = await Bootstrap.getMetadata();
        const chaincode = new ChaincodeFromContract(contracts, serializers, filemetadata);

        // say hello to the peer
        shim.start(chaincode);
    }

    /**
     *
     * @ignore
     */
    static async bootstrap() {
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

            // check the contracts and setup those up.
            if (r.contracts) {
                await Bootstrap.register(r.contracts, serializers);
            } else {
                await Bootstrap.register([r], serializers);
            }
        } else {
            throw new Error('package.json does not contain a \'main\' entry for the module');
        }
    }

    /**
     * Gets meta data associated with this Chaincode deployment
     */
    static async getMetadata() {
        let metadata = {};
        const opts = StartCommand.getArgs(yargs);
        const modPath = path.resolve(process.cwd(), opts['module-path']);
        const metadataPath = path.resolve(modPath, 'contract-metadata', 'metadata.json');
        const pathCheck = await fs.pathExists(metadataPath);

        if (pathCheck) {
            metadata = await Bootstrap.loadAndValidateMetadata(metadataPath);
            logger.info('Meta data file has been located');
        } else {
            logger.info('No metadata file supplied in contract, introspection will generate all the data');
        }
        return metadata;
    }


    static async loadAndValidateMetadata(metadataPath) {
        const rootPath = path.dirname(__dirname);
        const metadataString = (await fs.readFile(metadataPath)).toString();
        const schemaString = (await fs.readFile(path.join(rootPath, '../../fabric-contract-api/schema/contract-schema.json'))).toString();

        const metadata = JSON.parse(metadataString);

        const ajv = new Ajv({schemaId: 'id'});
        ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
        const valid = ajv.validate(JSON.parse(schemaString), metadata);
        if (!valid) {
            throw new Error('Contract metadata does not match the schema: ' + JSON.stringify(ajv.errors));
        } else {
            logger.info('Metadata validated against schema correctly');
        }
        return metadata;
    }
}

module.exports = Bootstrap;



