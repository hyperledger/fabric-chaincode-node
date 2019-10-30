/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Logger = require('./logger');
const logger = Logger.getLogger('./lib/jsontransactionserializer.js');
const {classToPlain, plainToClass} = require('class-transformer');

/**
 * Uses the standard JSON serialization methods for converting to and from JSON strings
 * (and buffers).
 *
 * Buffers are converted to the format of {type:'Buffer', data:xxxxx }
 * If a object has a toJSON() method then that will be used - as this uses the stadnard
 * JSON.stringify() approach
 *
 */
module.exports = class JSONSerializer {

    /** Takes the result and produces a buffer that matches this serialization format
     * @param {Object} result to be converted
     * @return {Buffer} container the encoded data
    */
    toBuffer (result, schema = {}, loggerPrefix) {

        // relay on the default algorithms, including for Buffers. Just retunring the buffer
        // is not helpful on inflation; is this a buffer in and of itself, or a buffer to inflated to JSON?
        if (!(typeof (result) === 'undefined' || result === null)) {
            // check that schema to see exactly how we should de-marshall this
            if (schema.type && (schema.type === 'string' || schema.type === 'number')) {
                // ok so this is a basic primitive type, and for strings and numbers the wireprotocol is different
                // double check the type of the result passed in
                if (schema.type !== typeof result) {
                    logger.error(`${loggerPrefix} toBuffer validation against schema failed on type`, typeof result, schema.type);
                    throw new Error(`Returned value is ${typeof result} does not match schema type of ${schema.type}`);
                }
                return Buffer.from(result.toString());
            } else if (typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean') {
                return Buffer.from(result.toString());
            } else {
                logger.debug(`${loggerPrefix} toBuffer has no schema/lacks sufficient schema to validate against`, schema);
                const payload = JSON.stringify(classToPlain(result));
                return Buffer.from(payload);
            }
        } else {
            return;
        }
    }

    /**
     * Inflates the data to the object or other type
     *
     * If on inflation the object has a type field that will throw
     * an error if it is not 'Buffer'
     *
     * @param {Buffer} data byte buffer containing the data
     * @return {Object} the resulting type
     *
     */
    fromBuffer (data, fullschema, loggerPrefix) {

        if (!data) {
            logger.error(`${loggerPrefix} fromBuffer no data supplied`);
            throw new Error('Buffer needs to be supplied');
        }

        if (!fullschema) {
            throw new Error('Schema has not been specified');
        }

        const stringData = data.toString('utf8');

        return this._fromString(stringData, fullschema, loggerPrefix);
    }

    _fromString (stringData, fullschema, loggerPrefix) {
        let value;
        let jsonForValidation;
        let schema = fullschema.properties.prop;

        // check that schema to see exactly how we should de-marshall this
        // first confirm if this is a reference or not
        if (schema.$ref) {
            // set this as required
            const type = schema.$ref.split(/\//).pop();
            schema = fullschema.components.schemas[type];
            schema.type = 'object';
            logger.debug(`${loggerPrefix} tweaked schema to be ${schema}`);
        }

        // now can proceed to do the required conversion
        if (schema.type) {
            if (schema.type === 'string') {
                logger.debug(`${loggerPrefix} fromBuffer handling data as string`);
                // ok so this is a basic primitive type, and for strings and numbers the wireprotocol is different
                value = stringData;
                jsonForValidation = JSON.stringify(value);

                return {value, jsonForValidation};
            } else if (schema.type === 'number') {
                logger.debug(`${loggerPrefix} fromBuffer handling data as number`);
                value = Number(stringData);
                jsonForValidation = value;

                if (isNaN(jsonForValidation)) {
                    throw new Error('fromBuffer could not convert data to number', stringData);
                }
                return {value, jsonForValidation};
            } else if (schema.type === 'boolean') {
                logger.debug(`${loggerPrefix} fromBuffer handling data as boolean`);
                const b = stringData.trim().toLowerCase();
                switch (b) {
                    case 'true':
                        value = true;
                        break;
                    case 'false':
                        value = false;
                        break;
                    default:
                        throw new Error('fromBuffer could not convert data to boolean', stringData);

                }
                jsonForValidation = value;
                return {value, jsonForValidation};
            } else if (schema.type === 'object') {
                logger.debug(`${loggerPrefix} fromBuffer assuming data as object`);
                // so this implies we have some json that should be formed up as an object
                // need to get the constructor
                const cnstr = fullschema.components.schemas[schema.$id].cnstr;
                if (cnstr) {
                    logger.debug(`${loggerPrefix} fromBuffer handling data as object`);
                    jsonForValidation = JSON.parse(stringData);
                    value = plainToClass(cnstr, jsonForValidation);
                    return {value, jsonForValidation};
                }
                logger.debug(`${loggerPrefix} no known constructor`);
            } else if (schema.type === 'array') {

                jsonForValidation = JSON.parse(stringData);

                value = jsonForValidation.map((v) => {
                    const _schema =
                    {
                        properties: {
                            prop: schema.items
                        },
                        components: fullschema.components
                    };

                    return (this._fromString(JSON.stringify(v), _schema, loggerPrefix)).value;
                });
                return {value, jsonForValidation};
            }
        }

        try {
            jsonForValidation = JSON.parse(stringData);
            if (jsonForValidation.type && jsonForValidation.type === 'Buffer') {
                logger.debug(`${loggerPrefix} fromBuffer handling data as buffer`);
                value = Buffer.from(jsonForValidation.data);
            } else {
                logger.debug(`${loggerPrefix} fromBuffer handling value and validation as the same`);
                value = jsonForValidation;
            }
        } catch (err) {
            logger.error('fromBuffer could not parse data as JSON to allow it to be converted to type: ' + JSON.stringify(schema.type), stringData, err);
            logger.error('Converting data to string and JSON.stringify-ing');
            value = stringData;
            jsonForValidation = JSON.stringify(value);
        }

        return {value, jsonForValidation};
    }

};
