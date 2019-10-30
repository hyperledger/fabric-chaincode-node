/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const Logger = require('../logger');
const logger = Logger.getLogger('contracts-spi/datamarshall.js');
const Ajv = require('ajv');

/** DataMarshall
 * An important class that provides the bridge between the serializers that are defining the wire (and ledger) data formats
 * and the code that is being invoked in the smart contracts.
 *
 * The job of this class is to take the parameters, and return types, along with the schemas from the meta data
 * and provide the place where validation and conversion can take place
 */
module.exports = class DataMarshall {

    /** Constructs a DataMarshall that is able to use a serializer to convert to and from the buffers
     * that are used in variety of places.
     *
     * @param {String} requestedSerializer name of the requested serializer
     * @param {Object} serializers mapping of names to the implementation of the serializers
     */
    constructor(requestedSerializer, serializers, components) {
        logger.debug('New DataMarshaller', requestedSerializer, serializers, components);
        let cnstr = serializers[requestedSerializer];
        if (typeof cnstr === 'string') {
            cnstr = require(cnstr);
        }

        // create the serailizer instance for this marsahll
        this.serializer = new (cnstr)();

        // setup an instance of the AJV JSONSchema parser to process the types
        this.ajv = new Ajv({useDefaults: true,
            coerceTypes: false,
            allErrors: true
        });

        this.components = components;
    }

    /**
     * Convert the result into a buffer than can be hand off to grpc (via the shim)
     * to be sent back to the peer
     *
     * @param {Object} result something to send
     * @param {Object} schema Fragment of JSON schema that defines this type
     * @return {Buffer} byte buffer to send
     */
    toWireBuffer(result, schema = {}, loggerPrefix) {
        return this.serializer.toBuffer(result, schema, loggerPrefix);
    }

    /**
     * Convert the result from a buffer that has come from the wire (via GRPC)
     * back to an object
     *
     * @param {Object} result something to send
     * @param {Object} schema Fragment of JSON schema that defines this type
     * @return {Object} value is the object to pass to the tx function, and validateData is the data that should be
     *                  validated for correctness
     */
    fromWireBuffer(result, schema = {}, loggerPrefix) {
        const {value, validateData} =  this.serializer.fromBuffer(result, schema, loggerPrefix);

        return {value, validateData:(validateData ? validateData : value)};
    }

    /**
     * Process all the parameters
     *
     * @param {object} fn Function currently being called
     * @param {array} parameters Parameters as passed from the shim
     * @return {array} of parameters that can be passed to the actual tx function
     */
    handleParameters(fn, parameters, loggerPrefix) {
        const expectedParams = fn.parameters;
        if (!expectedParams) {
            if (parameters.length > 0) {   // this is from a pure javascript inferred contract
                return parameters.map((e) => {
                    return e.toString();
                });
            } else {
                return [];
            }
        }

        if (expectedParams.length !== parameters.length) {
            const errMsg = `Expected ${expectedParams.length} parameters, but ${parameters.length} have been supplied`;
            logger.error(`${loggerPrefix} ${errMsg}`);
            throw new Error(errMsg);
        }

        const returnParams = [];

        // check each parameter matches the type and then demarshall
        for (let i = 0; i < fn.parameters.length; i++) {
            const supplied = parameters[i];
            const expected = expectedParams[i];
            logger.debug(`${loggerPrefix} Expected parameter ${JSON.stringify(expected)}`);
            logger.debug(`${loggerPrefix} Supplied parameter ${require('util').inspect(supplied)}`);
            // check the type
            const schema = {
                properties: {
                    prop: expected.schema
                },
                components: {
                    schemas: this.components
                }
            };

            if (!expected.schema.type && !expected.schema.$ref) {
                throw new Error(`Incorrect type information ${JSON.stringify(expected.schema)}`);
            }

            const validator = this.ajv.compile(schema);

            const {value, validateData} = this.fromWireBuffer(supplied, schema, loggerPrefix);
            logger.debug(`${JSON.stringify(validateData)}`);
            logger.debug(`${JSON.stringify(schema)}`);
            const valid = validator({prop:validateData});

            if (!valid) {
                const errors = JSON.stringify(validator.errors.map((err) => {
                    return err.message;
                }));
                logger.debug(`${loggerPrefix} ${errors}`);
                throw new Error(`Unable to validate parameter due to ${errors}`);
            }

            returnParams.push(value);
        }
        logger.debug(`${loggerPrefix} Processed params ${returnParams}`);
        return returnParams;
    }
};
