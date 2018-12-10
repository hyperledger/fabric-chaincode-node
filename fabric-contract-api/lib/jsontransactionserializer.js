/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

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
    toBuffer(result, schema = {}) {

        // relay on the default algorithms, including for Buffers. Just retunring the buffer
        // is not helpful on inflation; is this a buffer in and of itself, or a buffer to inflated to JSON?
        if (result) {
            // check that schema to see exactly how we should de-marshall this
            if (schema.type && (schema.type === 'string' || schema.type === 'number')) {
                // ok so this is a basic primitive type, and for strings and numbers the wireprotocol is different
                // double check the type of the result passed in
                if (schema.type !== typeof result) {
                    throw new Error(`Returned value is ${typeof result} does not match schema type of ${schema.type}`);
                }
                return Buffer.from(result.toString());
            } else {
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
    fromBuffer(data, schema = {}) {

        if (!data) {
            throw new Error('Buffer needs to be supplied');
        }
        let value;
        let jsonForValidation;
        // check that schema to see exactly how we should de-marshall this
        if (schema.type && (schema.type === 'string' || schema.type === 'number')) {
            // ok so this is a basic primitive type, and for strings and numbers the wireprotocol is different
            value = data.toString();
            jsonForValidation = JSON.stringify(value);
        } else {

            const json = JSON.parse(data.toString());
            if (json.type) {
                if (json.type === 'Buffer') {
                    value = Buffer.from(json.data);
                } else {
                    throw new Error(`Type of ${json.type} is not understood, can't recreate data`);
                }
            } else {
                value = json;
            }
            // as JSON then this si the same
            jsonForValidation = value;
        }

        return {value, jsonForValidation};
    }

};
