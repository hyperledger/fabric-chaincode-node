/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const path = require('node:path');
const yargs = require('yargs');
const Ajv = require('ajv');
const fs = require('node:fs');

const shim = require('../chaincode');
const ChaincodeFromContract = require('./chaincodefromcontract');
const Logger = require('../logger');
const StartCommand = require('../cmds/startCommand.js');
const ServerCommand = require('../cmds/serverCommand.js');

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
    static async register(contracts, serializers, fileMetadata, title, version, opts, serverMode = false) {
        // load up the meta data that the user may have specified
        // this will need to passed in and rationalized with the
        // code as implemented
        const chaincode = new ChaincodeFromContract(contracts, serializers, fileMetadata, title, version);

        if (serverMode) {
            const server = shim.server(chaincode, opts);
            await server.start();
        } else {
            // say hello to the peer
            shim.start(chaincode);
        }
    }

    /**
     *
     * @ignore
     * @param {boolean} serverMode set true if the chaincode should be started as a server
     */
    static async bootstrap(serverMode = false) {
        const opts = serverMode ? ServerCommand.getArgs(yargs) : StartCommand.getArgs(yargs);
        const {contracts, serializers, title, version} = this.getInfoFromContract(opts['module-path']);
        const fileMetadata = await Bootstrap.getMetadata(opts['module-path']);
        await Bootstrap.register(contracts, serializers, fileMetadata, title, version, opts, serverMode);
    }

    static getInfoFromContract(modulePath) {
        const modPath = path.resolve(process.cwd(), modulePath);
        const jsonPath = path.resolve(modPath, 'package.json');
        // let's find the package.json file
        const json = require(jsonPath);
        logger.debug('starting up and reading package.json at %s', jsonPath);
        logger.debug('read JSON', json);
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

            if (r.contracts) {
                return {contracts: r.contracts, serializers, title: json.name, version: json.version};
            }

            return {contracts: [r], serializers, title: json.name, version: json.version};
        } else {
            throw new Error('package.json does not contain a \'main\' entry for the module');
        }
    }
    /**
     * Gets meta data associated with this Chaincode deployment
     */
    static async getMetadata(modulePath) {
        let metadata = {};
        const modPath = path.resolve(process.cwd(), modulePath);
        let metadataPath = path.resolve(modPath, 'META-INF', 'metadata.json');
        let pathCheck = await fs.promises.access(metadataPath).then(() => true, () => false);

        if (!pathCheck) {
            metadataPath = path.resolve(modPath, 'contract-metadata', 'metadata.json');
            pathCheck = await fs.promises.access(metadataPath).then(() => true, () => false);
        }

        if (pathCheck) {
            metadata = Bootstrap.loadAndValidateMetadata(metadataPath);
            logger.debug('Loaded metadata', metadata);
        } else {
            logger.info('No metadata file supplied in contract, introspection will generate all the data');
        }
        return metadata;
    }

    static noop() {}

    static loadAndValidateMetadata(metadataPath) {
        const rootPath = path.dirname(__dirname);
        const metadataString = fs.readFileSync(metadataPath).toString();
        const schemaString = fs.readFileSync(path.join(rootPath, '../../fabric-contract-api/schema/contract-schema.json')).toString();

        const metadata = JSON.parse(metadataString);

        const onlyErrors = {log: Bootstrap.noop, warn: Bootstrap.noop, error: console.error}; // eslint-disable-line no-console
        const ajv = new Ajv({schemaId: 'id', logger: onlyErrors});
        ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
        const valid = ajv.validate(JSON.parse(schemaString), metadata);
        if (!valid) {
            throw new Error('Contract metadata does not match the schema: ' + JSON.stringify(ajv.errors));
        }
        return metadata;
    }
}

module.exports = Bootstrap;



