'use strict';
const ProtoLoader = require('./protoloader');
const path = require('path');
const EventEmitter = require('events');

const _queryresultProto = ProtoLoader.load({
    root: path.join(__dirname, './protos'),
    file: 'ledger/queryresult/kv_query_result.proto'
}).queryresult;

/**
 * CommonIterator allows a chaincode to check whether any more result(s)
 * need to be fetched from an iterator and close it when done.
 *
 * @class
 * @memberof fabric-shim
 */
class CommonIterator extends EventEmitter {

    /**
	 * constructor
	 * @param {ChaincodeSupportClient} handler client handler
	 * @param {string} channel_id channel id
	 * @param {string} txID transaction id
	 * @param {object} response decoded payload
	 */
    constructor(handler, channel_id, txID, response, type) {
        super();
        this.type = type;
        this.handler = handler;
        this.channel_id = channel_id;
        this.txID = txID;
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
        return await this.handler.handleQueryStateClose(this.response.id, this.channel_id, this.txID);
    }

    /*
	 * decode the payload depending on the type of iterator.
	 * @param {object} bytes
	 */
    _getResultFromBytes(bytes) {
        if (this.type === 'QUERY') {
            return _queryresultProto.KV.decode(bytes.resultBytes);
        } else if (this.type === 'HISTORY') {
            return _queryresultProto.KeyModification.decode(bytes.resultBytes);
        }
        throw new Error('Iterator constructed with unknown type: ' + this.type);
    }


    /*
	 * creates a return value and emits an event
	 */
    _createAndEmitResult() {
        const queryResult = {};
        queryResult.value = this._getResultFromBytes(this.response.results[this.currentLoc]);
        this.currentLoc++;
        queryResult.done = !(this.currentLoc < this.response.results.length || this.response.has_more);
        if (this.listenerCount('data') > 0) {
            this.emit('data', this, queryResult);
        }
        return queryResult;
    }

    /**
	 * Get the next value and return it through a promise and also emit
	 * it if event listeners have been registered.
	 * @async
	 * @return {promise} a promise that is fulfilled with the next value.
	 * If there is no more next value, "done" key of the object is true.
	 * It is rejected if any error occurs.
	 */
    async next() {
        // check to see if there are some results left in the current result set
        if (this.currentLoc < this.response.results.length) {
            return this._createAndEmitResult();
        } else {
            // check to see if there is more and go fetch it
            if (this.response.has_more) {
                try {
                    const response = await this.handler.handleQueryStateNext(this.response.id, this.channel_id, this.txID);
                    this.currentLoc = 0;
                    this.response = response;
                    return this._createAndEmitResult();
                } catch (err) {
                    // if someone is utilising the event driven way to work with
                    // iterators (by explicitly checking for data here, not error)
                    // then emit an error event. This means it will emit an event
                    // even if no-one is listening for the error event. Error events
                    // are handled specially by Node.
                    if (this.listenerCount('data') > 0) {
                        this.emit('error', this, err);
                        return;
                    }
                    throw err;
                }
            }
            // no more, just return EMCA spec defined response
            if (this.listenerCount('end') > 0) {
                this.emit('end', this);
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
