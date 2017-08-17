/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const grpc = require('grpc');
const path = require('path');
const util = require('util');
const utf8 = require('utf8');

const _commonProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'common/common.proto'
}).common;

const _proposalProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/proposal.proto'
}).protos;

const _eventProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode_event.proto'
}).protos;

const _idProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'msp/identities.proto'
}).msp;

const logger = require('./logger').getLogger('lib/chaincode.js');

const RESPONSE_CODE = {
	// OK constant - status code less than 400, endorser will endorse it.
	// OK means init or invoke successfully.
	OK: 200,

	// ERRORTHRESHOLD constant - status code greater than or equal to 400 will be considered an error and rejected by endorser.
	ERRORTHRESHOLD: 400,

	// ERROR constant - default error value
	ERROR: 500
};

const MIN_UNICODE_RUNE_VALUE = '\u0000';
const MAX_UNICODE_RUNE_VALUE = '\u0010\uffff';
const COMPOSITEKEY_NS = '\x00';
const EMPTY_KEY_SUBSTITUTE = '\x01';

function _validateCompositeKeyAttribute(attr) {
	if (typeof attr !== 'string' || attr.length === 0) {
		throw new Error('object type or attribute not a non-zero length string');
	}
	utf8.decode(attr);
}

let Stub = class {
	constructor(client, txId, chaincodeInput, signedProposal) {
		this.txId = txId;
		this.args = chaincodeInput.args.map((entry) => {
			let ret;
			// attempt to parse the input as JSON first
			try {
				ret = JSON.parse(entry.toBuffer());
			} catch(err) {
				ret = entry.toBuffer().toString();
			}

			return ret;
		});
		this.handler = client;

		if (signedProposal) {
			let decodedSP = {
				signature: signedProposal.signature
			};

			let proposal;
			try {
				proposal = _proposalProto.Proposal.decode(signedProposal.proposal_bytes);
				decodedSP.proposal = {};
				this.proposal = proposal;
			} catch(err) {
				throw new Error(util.format('Failed extracting proposal from signedProposal. [%s]', err));
			}

			if (!this.proposal.header || this.proposal.header.toBuffer().length === 0)
				throw new Error('Proposal header is empty');

			if (!this.proposal.payload || this.proposal.payload.toBuffer().length === 0)
				throw new Error('Proposal payload is empty');

			let header;
			try {
				header = _commonProto.Header.decode(this.proposal.header);
				decodedSP.proposal.header = {};
			} catch(err) {
				throw new Error(util.format('Could not extract the header from the proposal: %s', err));
			}

			let signatureHeader;
			try {
				signatureHeader = _commonProto.SignatureHeader.decode(header.signature_header);
				decodedSP.proposal.header.signature_header = { nonce: signatureHeader.getNonce().toBuffer() };
			} catch(err) {
				throw new Error(util.format('Decoding SignatureHeader failed: %s', err));
			}

			let creator;
			try {
				creator = _idProto.SerializedIdentity.decode(signatureHeader.creator);
				decodedSP.proposal.header.signature_header.creator = creator;
				this.creator = creator;
			} catch(err) {
				throw new Error(util.format('Decoding SerializedIdentity failed: %s', err));
			}

			let channelHeader;
			try {
				channelHeader = _commonProto.ChannelHeader.decode(header.channel_header);
				decodedSP.proposal.header.channel_header = channelHeader;
				this.txTimeStamp = channelHeader.timestamp;
			} catch(err) {
				throw new Error(util.format('Decoding ChannelHeader failed: %s', err));
			}

			let ccpp;
			try {
				ccpp = _proposalProto.ChaincodeProposalPayload.decode(this.proposal.payload);
				decodedSP.proposal.payload = ccpp;
			} catch(err) {
				throw new Error(util.format('Decoding ChaincodeProposalPayload failed: %s', err));
			}

			this.transientMap = ccpp.getTransientMap();

			this.signedProposal = decodedSP;

			// TODO: compute binding based on nonce, creator and epoch
			this.binding = '';
		}
	}

	getArgs() {
		return this.args;
	}

	getStringArgs() {
		return this.args.map((arg) => {
			return arg.toString();
		});
	}

	getFunctionAndParameters() {
		let values = this.getStringArgs();
		if (values.length >= 1) {
			return {
				fcn: values[0],
				params: values.slice(1)
			};
		} else {
			return {
				fcn: '',
				params: []
			};
		}
	}

	getTxID() {
		return this.txId;
	}

	getCreator() {
		return this.creator;
	}

	getTransient() {
		return this.transientMap;
	}

	getSignedProposal() {
		return this.signedProposal;
	}

	getTxTimestamp() {
		return this.txTimestamp;
	}

	getState(key) {
		return this.handler.handleGetState(key, this.txId);
	}

	putState(key, value) {
		return this.handler.handlePutState(key, value, this.txId);
	}

	deleteState(key) {
		return this.handler.handleDeleteState(key, this.txId);
	}

	getStateByRange(startKey, endKey) {
		return this.handler.handleGetStateByRange(startKey, endKey, this.txId);
	}

	setEvent(name, payload) {
		if (typeof name !== 'string' || name === '')
			throw new Error('Event name must be a non-empty string');

		let event = new _eventProto.ChaincodeEvent();
		event.setEventName(name);
		event.setPayload(payload);
		this.chaincodeEvent = event;
	}

	/**
	 * Create a composite key
	 * @param {string} objectType
	 * @param {array} attributes
	 * @return {string} a composite key made up from the inputs
	 */
	createCompositeKey(objectType, attributes) {
		_validateCompositeKeyAttribute(objectType);
		if (!Array.isArray(attributes)) {
			throw new Error('attributes must be an array');
		}

		let compositeKey = COMPOSITEKEY_NS + objectType + MIN_UNICODE_RUNE_VALUE;
		attributes.forEach((attribute) => {
			_validateCompositeKeyAttribute(attribute);
			compositeKey = compositeKey + attribute + MIN_UNICODE_RUNE_VALUE;
		});
		return compositeKey;
	}



	/**
	 * Return the various values for a partial key
	 * @param {string} objectType
	 * @param {array} attributes
	 * @return {promise} a promise that resolves with the returned values, rejects if an error occurs
	 */
	getStateByPartialCompositeKey(objectType, attributes) {
		let partialCompositeKey = this.createCompositeKey(objectType, attributes);
		return this.getStateByRange(partialCompositeKey, partialCompositeKey + MAX_UNICODE_RUNE_VALUE);
	}
};

module.exports = Stub;
module.exports.RESPONSE_CODE = RESPONSE_CODE;


