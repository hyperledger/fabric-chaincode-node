/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';


module.exports = class DataMarshall {

    /** Constructs a DataMarshall that is able to use a serializer to convert to and from the buffers
     * that are used in variety of places.
     *
     * @param {String} requestedSerializer name of the requested serializer
     * @param {Object} serializers mapping of names to the implementation of the serializers
     */
    constructor(requestedSerializer, serializers) {
        let cnstr = serializers[requestedSerializer];
        if (typeof cnstr === 'string') {
            cnstr = require(cnstr);
        }

        this.serializer = new (cnstr)();
    }

    /** Convert the result into a buffer than can be hand off to grpc (via the shim)
     * to be sent back to the peer
     *
     * @param {Object} result something to send
     * @return {Buffer} byte buffer to send
     */
    toWireBuffer(result) {
        return this.serializer.toBuffer(result);
    }

    /**
     * Convert the result from a buffer that has come from the wire (via GRPC)
     * back to an object
     *
     * @param {Object} result something to send
     * @return {Buffer} byte buffer to send
     */
    fromWireBuffer(result) {
        return this.serializer.fromBuffer(result);
    }

};
