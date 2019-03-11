/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Logger = require('./logger');
const logger = Logger.getLogger('./lib/jsontransactionserializer.js');

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
    toBuffer(result, schema = {}, loggerPrefix) {

        // relay on the default algorithms, including for Buffers. Just retunring the buffer
        // is not helpful on inflation; is this a buffer in and of itself, or a buffer to inflated to JSON?
        if (!(typeof(result) === 'undefined' || result === null)) {
            // check that schema to see exactly how we should de-marshall this
            if (schema.type && (schema.type === 'string' || schema.type === 'number')) {
                // ok so this is a basic primitive type, and for strings and numbers the wireprotocol is different
                // double check the type of the result passed in
                if (schema.type !== typeof result) {
                    logger.error(`${loggerPrefix} toBuffer validation against schema failed on type`, typeof result, schema.type);
                    throw new Error(`Returned value is ${typeof result} does not match schema type of ${schema.type}`);
                }
                return Buffer.from(result.toString());
            } else {
                logger.info(`${loggerPrefix} toBuffer has no schema/lacks sufficient schema to validate against`, schema);
                const payload = JSON.stringify(result);
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
    fromBuffer(data, schema = {}, loggerPrefix) {

        if (!data) {
            logger.error(`${loggerPrefix} fromBuffer no data supplied`);
            throw new Error('Buffer needs to be supplied');
        }
        let value;
        let jsonForValidation;
        // check that schema to see exactly how we should de-marshall this
        if (schema.type && (schema.type === 'string' || schema.type === 'number')) {
            if (schema.type === 'string') {
                logger.debug(`${loggerPrefix} fromBuffer handling data as string`);
                // ok so this is a basic primitive type, and for strings and numbers the wireprotocol is different
                value = data.toString();
                jsonForValidation = JSON.stringify(value);
            } else {
                logger.debug(`${loggerPrefix} fromBuffer handling data as number`);
                value = Number(data.toString());
                jsonForValidation = value;

                if (isNaN(jsonForValidation)) {
                    throw new Error('fromBuffer could not convert data to number', data);
                }
            }
        } else {
            let json;
            try {
                json = JSON.parse(data.toString());
            } catch (err) {
                if (schema.type === 'boolean') {
                    throw new Error('fromBuffer could not convert data to boolean', data);
                }
                throw new Error('fromBuffer could not parse data as JSON to allow it to be converted to type: ' + JSON.stringify(schema.type), data, err);
            }
            if (json.type) {
                logger.debug(`${loggerPrefix} fromBuffer handling data as buffer`);
                if (json.type === 'Buffer') {
                    value = Buffer.from(json.data);
                } else {
                    logger.error('fromBuffer could not convert data to useful type', data);
                    throw new Error(`${loggerPrefix} Type of ${json.type} is not understood, can't recreate data`);
                }
            } else {
                logger.debug(`${loggerPrefix} fromBuffer handling data as json`);
                value = json;
            }
            // as JSON then this si the same
            jsonForValidation = value;
        }

        return {value, jsonForValidation};
    }

};
