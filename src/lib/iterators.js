'use strict';
const grpc = require('grpc');
const path = require('path');
const EventEmitter = require('events');

const _queryresultProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'ledger/queryresult/kv_query_result.proto'
}).queryresult;

/**
 * A common iterator
 */
class CommonIterator extends EventEmitter {

	/**
	 * constructor
	 * @param {ChaincodeSupportClient} handler client handler
	 * @param {string} txID transaction id
	 * @param {object} response decoded payload
	 */
	constructor(handler, txID, response, type) {
		super();
		this.type = type;
		this.handler = handler;
		this.txID = txID;
		this.response = response;
		this.currentLoc = 0;
	}

	/**
	 * close the iterator.
	 * @return {promise} A promise that is resolved with the close payload or rejected
	 * if there is a problem
	 */
	close() {
		return this.handler.handleQueryStateClose(this.response.id, this.txID);
	}

	/**
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


	/**
	 * creates a return value and emits an event
	 */
	_createAndEmitResult() {
		let queryResult = {};
		queryResult.value = this._getResultFromBytes(this.response.results[this.currentLoc]);
		this.currentLoc++;
		queryResult.done = !(this.currentLoc < this.response.results.length || this.response.has_more);
		this.emit('data', this, queryResult);
		if (queryResult.done) {
			this.emit('end', this);
		}
		return queryResult;
	}

	/**
	 * Get the next value
	 * @return {promise} a promise that is fulfilled with the next value or
	 * is rejected otherwise
	 */
	next() {
		// check to see if there are some results left in the current result set
		if (this.currentLoc < this.response.results.length) {
			return Promise.resolve(this._createAndEmitResult());
		}
		else {
			// check to see if there is more and go fetch it
			if (this.response.has_more) {
				return this.handler.handleQueryStateNext(this.response.id, this.txID)
					.then((response) => {
						this.currentLoc = 0;
						this.response = response;
						return this._createAndEmitResult();
					});
			}
			// no more, just return EMCA spec defined response
			this.emit('end', this);
			return Promise.resolve({done: true});
		}

	}

}

/**
 * A State Query iterator
 */
class StateQueryIterator extends CommonIterator {
	constructor(handler, txID, response) {
		super(handler, txID, response, 'QUERY');
	}
}

/**
 * A History Query iterator
 */
class HistoryQueryIterator extends CommonIterator {
	constructor(handler, txID, response) {
		super(handler, txID, response, 'HISTORY');
	}
}

module.exports.StateQueryIterator = StateQueryIterator;
module.exports.HistoryQueryIterator = HistoryQueryIterator;