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
    constructor(requestedSerializer, serializers, schemas) {
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

        // the complex type schemas from the metadata
        this.schemas = schemas;
    }

    /**
     * Convert the result into a buffer than can be hand off to grpc (via the shim)
     * to be sent back to the peer
     *
     * @param {Object} result something to send
     * @param {Object} schema Fragment of JSON schema that defines this type
     * @return {Buffer} byte buffer to send
     */
    toWireBuffer(result, schema = {}) {
        return this.serializer.toBuffer(result, schema);
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
    fromWireBuffer(result, schema = {}) {
        const {value, validateData} =  this.serializer.fromBuffer(result, schema);

        return {value, validateData:(validateData ? validateData : value)};
    }

    /**
     * Process all the parameters
     *
     * @param {object} fn Function currently being called
     * @param {array} parameters Parameters as passed from the shim
     * @return {array} of parameters that can be passed to the actual tx function
     */
    handleParameters(fn, parameters) {
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
            throw new Error(`Expected ${expectedParams.length} parameters, but ${parameters.length} have been supplied`);
        }

        const returnParams = [];

        // check each parameter matches the type and then demarshall
        for (let i = 0; i < fn.parameters.length; i++) {
            const supplied = parameters[i];
            const expected = expectedParams[i];
            logger.debug(expected);
            logger.debug(supplied);
            // check the type
            const schema = expected.schema;

            // const name = expected.name;
            if (schema.type) {

                const {value, validateData} = this.fromWireBuffer(supplied, expected.schema);
                const validator = this.ajv.compile(schema);
                const valid = validator(validateData);
                logger.debug(`Argument is ${valid}`);
                if (!valid) {
                    const errors = JSON.stringify(validator.errors);
                    logger.debug(errors);
                    throw new Error(`Unable to validate parameter due to ${errors}`);
                }

                returnParams.push(value);
            } else if (schema.$ref) {
                const n = schema.$ref.lastIndexOf('/');
                const typeName = schema.$ref.substring(n + 1);
                const {value, validateData} = this.fromWireBuffer(supplied, expected.schema);
                const valid = this.schemas[typeName].validator(validateData);
                logger.debug(`${validateData.toString()} is ${valid}`);
                if (!valid) {
                    const errors = JSON.stringify(this.schemas[typeName].validator.errors);
                    logger.debug(errors);
                    throw new Error(`Unable to validate parameter due to ${errors}`);
                }
                returnParams.push(value);
            } else {
                throw new Error(`Incorrect type information ${JSON.stringify(schema)}`);
            }
        }
        logger.debug(returnParams);
        return returnParams;
    }
};
