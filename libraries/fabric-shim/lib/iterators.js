/*
# Copyright Zhao Chaoyi. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const logger = require('./logger').getLogger('lib/iterators.js');

const {ledger} = require('@hyperledger/fabric-protos');

/**
 * CommonIterator allows a chaincode to check whether any more result(s)
 * need to be fetched from an iterator and close it when done.
 *
 * @class
 * @memberof fabric-shim
 */
class CommonIterator {

    /**
     * constructor
     *
     * Note that the decoded payload will be a protobuf of type
     * fabprotos.protos.QueryResponse
     *
     * @param {ChaincodeSupportClient} handler client handler
     * @param {string} channel_id channel id
     * @param {string} txID transaction id
     * @param {object} response decoded payload
     */
    constructor(handler, channel_id, txID, response, type) {
        this.type = type;
        this.handler = handler;
        this.channel_id = channel_id;
        this.txID = txID;

        // this response is a peer.QueryResponse object
        this.response = response;
        this.currentLoc = 0;
    }

    /**
     * close the iterator.
     * @async
     * @return {promise} A promise that is resolved with the close payload or rejected
     * if there is a problem
     */
    async close() {
        logger.debug('close called on %s iterator for txid: %s', this.type, this.txID);
        return await this.handler.handleQueryStateClose(this.response.getId(), this.channel_id, this.txID);
    }

    /*
     * creates a return value
     */
    _createAndEmitResult() {
        const resultsList = this.response.getResultsList();
        let queryResult;

        // established external API has a very specific structure here
        // so need to 'fluff' up this structure to match
        // Not all queryResults have the same methods
        if (this.type === 'QUERY') {
            const queryResultPb = ledger.queryresult.KV.deserializeBinary((resultsList[this.currentLoc]).getResultbytes());
            queryResult = {
                key: queryResultPb.getKey(),
                value: Buffer.from(queryResultPb.getValue())
            };
        } else if (this.type === 'HISTORY') {
            const queryResultPb = ledger.queryresult.KeyModification.deserializeBinary((resultsList[this.currentLoc]).getResultbytes());
            queryResult = {
                txId: queryResultPb.getTxId(),
                value: Buffer.from(queryResultPb.getValue()),
                isDelete: queryResultPb.getIsDelete(),
                timestamp: queryResultPb.getTimestamp().toObject()

            };
        } else {
            throw new Error('Iterator constructed with unknown type: ' + this.type);
        }

        this.currentLoc++;

        return {value: queryResult, done: false};
    }

    /**
     * Get the next value and return it through a promise.
     * @async
     * @return {promise} a promise that is fulfilled with an object { value: (next value) },
     * is fulfilled with an object { done: true } if there is no more value,
     * or is rejected if any error occurs.
     */
    async next() {
        // check to see if there are some results left in the current result set
        const resultsList = this.response.getResultsList();
        if (this.currentLoc < resultsList.length) {
            return this._createAndEmitResult();
        } else {
            // check to see if there is more and go fetch it
            if (this.response.getHasMore()) {
                try {
                    const response = await this.handler.handleQueryStateNext(this.response.getId(), this.channel_id, this.txID);
                    this.currentLoc = 0;
                    this.response = response;
                    return this._createAndEmitResult();
                } catch (err) {
                    logger.error('unexpected error received getting next value: %s', err.message);
                    throw err;
                }
            }
            return {done: true};
        }

    }

}

/**
 * A State Query iterator allows a chaincode to iterate over a
 * set of key/value pairs returned by range and execute queries
 *
 * @extends CommonIterator
 * @memberof fabric-shim
 */
class StateQueryIterator extends CommonIterator {
    constructor(handler, channel_id, txID, response) {
        super(handler, channel_id, txID, response, 'QUERY');
    }
}

/**
 * A History Query iterator allows a chaincode to iterate over a
 * set of key/value pairs returned by a history query
 *
 * @extends CommonIterator
 * @memberof fabric-shim
 */
class HistoryQueryIterator extends CommonIterator {
    constructor(handler, channel_id, txID, response) {
        super(handler, channel_id, txID, response, 'HISTORY');
    }
}

module.exports.StateQueryIterator = StateQueryIterator;
module.exports.HistoryQueryIterator = HistoryQueryIterator;
