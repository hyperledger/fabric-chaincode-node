/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

//TODO: Need to add parameter validation to all calls.
'use strict';

const grpc = require('grpc');
const path = require('path');
const util = require('util');
const utf8 = require('utf8');
const crypto = require('crypto');

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
const MAX_UNICODE_RUNE_VALUE = '\uffff'; // Can't use '\u0010\uffff'
const COMPOSITEKEY_NS = '\x00';
const EMPTY_KEY_SUBSTITUTE = '\x01';

function validateCompositeKeyAttribute(attr) {
	if (typeof attr !== 'string' || attr.length === 0) {
		throw new Error('object type or attribute not a non-zero length string');
	}
	utf8.decode(attr);
}

function computeProposalBinding(decodedSP) {
	let nonce = decodedSP.proposal.header.signature_header.nonce;
	let creator = decodedSP.proposal.header.signature_header.creator.toBuffer();
	let epoch = decodedSP.proposal.header.channel_header.epoch;

	// see github.com/hyperledger/fabric/protos/utils/proputils.go, computeProposalBindingInternal()

	// the epoch will be encoded as little endian bytes of 8
	// it's a Long number with high and low values (since JavaScript only supports
	// 32bit unsigned integers)
	let buf = Buffer.allocUnsafe(8);
	buf.writeUInt32LE(epoch.low, 0);
	buf.writeUInt32LE(epoch.high, 4);

	let total = Buffer.concat([nonce, creator, buf], nonce.length + creator.length + 8);

	const hash = crypto.createHash('sha256');
	hash.update(total);
	return hash.digest('hex');
}

/**
 * The ChaincodeStub is implemented by the <code>fabric-shim</code>
 * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform.
 * The stub encapsulates the APIs between the chaincode implementation and the Fabric peer
 */
class ChaincodeStub {
	constructor(client, txId, chaincodeInput, signedProposal) {
		this.txId = txId;
		this.args = chaincodeInput.args.map((entry) => {
			return entry.toBuffer().toString();
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

			this.binding = computeProposalBinding(decodedSP);
		}
	}

	/**
	 * Returns the arguments as array of strings from the chaincode invocation request.
	 * Equivalent to [getStringArgs()]{@link ChaincodeStub#getStringArgs}
	 * @returns {string[]}
	 */
	getArgs() {
		return this.args;
	}

	/**
	 * Returns the arguments as array of strings from the chaincode invocation request
	 * @returns {string[]}
	 */
	getStringArgs() {
		return this.args;
	}

	/**
	 * @typedef FunctionAndParameters
	 * @property {string} fcn The function name, which by chaincode programming convention
	 * is the first argument in the array of arguments
	 * @property {string[]} params The rest of the arguments, as array of strings
	 */

	/**
	 * Returns an object containing the chaincode function name to invoke, and the array
	 * of arguments to pass to the target function
	 * @returns {FunctionAndParameters}
	 */
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

	/**
	 * Returns the transaction ID for the current chaincode invocation request. The transaction
	 * ID uniquely identifies the transaction within the scope of the channel.
	 */
	getTxID() {
		return this.txId;
	}

	/**
	 * This object contains the essential identity information of the chaincode invocation's submitter,
	 * including its organizational affiliation (mspid) and certificate (id_bytes)
	 * @typedef {Object} ProposalCreator
	 * @property {string} mspid The unique ID of the Membership Service Provider instance that is associated
	 * to the identity's organization and is able to perform digital signing and signature verification
	 */

	/**
	 * Returns the identity object of the chaincode invocation's submitter
	 * @returns {ProposalCreator}
	 */
	getCreator() {
		return this.creator;
	}

	/**
	 * Returns the transient map that can be used by the chaincode but not
	 * saved in the ledger, such as cryptographic information for encryption and decryption
	 * @returns {Map<string:Buffer>}
	 */
	getTransient() {
		return this.transientMap;
	}

	/**
	 * The SignedProposal object represents the request object sent by the client application
	 * to the chaincode.
	 * @typedef {Object} SignedProposal
	 * @property {Buffer} signature The signature over the proposal. This signature is to be verified against
	 * the {@link ProposalCreator} returned by <code>getCreator()</code>. The signature will have already been
	 * verified by the peer before the invocation request reaches the chaincode.
	 * @property {Proposal} proposal The object containing the chaincode invocation request and metadata about the request
	 */

	/**
	 * The essential content of the chaincode invocation request
	 * @typedef {Object} Proposal
	 * @property {Header} header The header object contains metadata describing key aspects of the invocation
	 * request such as target channel, transaction ID, and submitter identity etc.
	 * @property {ChaincodeProposalPayload} payload The payload object contains actual content of the invocation request
	 */

	/**
	 * @typedef {Object} Header
	 * @property {ChannelHeader} channel_header Channel header identifies the destination channel of the invocation
	 * request and the type of request etc.
	 * @property {SignatureHeader} signature_header Signature header has replay prevention and message authentication features
	 */

	/**
	 * Channel header identifies the destination channel of the invocation
	 * request and the type of request etc.
	 * @typedef {Object} ChannelHeader
	 * @property {number} type Any of the following:
	 * <ul>
	 * <li>MESSAGE = 0;                   // Used for messages which are signed but opaque
     * <li>CONFIG = 1;                    // Used for messages which express the channel config
     * <li>CONFIG_UPDATE = 2;             // Used for transactions which update the channel config
     * <li>ENDORSER_TRANSACTION = 3;      // Used by the SDK to submit endorser based transactions
     * <li>ORDERER_TRANSACTION = 4;       // Used internally by the orderer for management
     * <li>DELIVER_SEEK_INFO = 5;         // Used as the type for Envelope messages submitted to instruct the Deliver API to seek
     * <li>CHAINCODE_PACKAGE = 6;         // Used for packaging chaincode artifacts for install
     * </ul>
     * @property {number} version
     * @property {google.protobuf.Timestamp} timestamp The local time when the message was created by the submitter
     * @property {string} channel_id Identifier of the channel that this message bound for
     * @property {string} tx_id Unique identifier used to track the transaction throughout the proposal endorsement, ordering,
     * validation and committing to the ledger
     * @property {number} epoch
	 */

	/**
	 * @typedef {Object} SignatureHeader
	 * @property {ProposalCreator} creator The submitter of the chaincode invocation request
	 * @property {Buffer} nonce Arbitrary number that may only be used once. Can be used to detect replay attacks.
	 */

	/**
	 * @typedef {Object} ChaincodeProposalPayload
	 * @property {Buffer} input Input contains the arguments for this invocation. If this invocation
	 * deploys a new chaincode, ESCC/VSCC are part of this field. This is usually a marshaled ChaincodeInvocationSpec
	 * @property {Map<string:Buffer>} transientMap TransientMap contains data (e.g. cryptographic material) that might be used
	 * to implement some form of application-level confidentiality. The contents of this field are supposed to always
	 * be omitted from the transaction and excluded from the ledger.
	 */

	/**
	 * Returns a fully decoded object of the signed transaction proposal
	 * @returns {SignedProposal}
	 */
	getSignedProposal() {
		return this.signedProposal;
	}

	getTxTimestamp() {
		return this.txTimestamp;
	}

	getBinding() {
		return this.binding;
	}

	async getState(key) {
		return await this.handler.handleGetState(key, this.txId);
	}

	async putState(key, value) {
		return await this.handler.handlePutState(key, value, this.txId);
	}

	async deleteState(key) {
		return await this.handler.handleDeleteState(key, this.txId);
	}

	async getStateByRange(startKey, endKey) {
		if (!startKey || startKey.length === 0) {
			startKey = EMPTY_KEY_SUBSTITUTE;
		}
		return await this.handler.handleGetStateByRange(startKey, endKey, this.txId);
	}

	async getQueryResult(query) {
		return await this.handler.handleGetQueryResult(query, this.txId);
	}

	async getHistoryForKey(key) {
		return await this.handler.handleGetHistoryForKey(key, this.txId);
	}

	async invokeChaincode(chaincodeName, args, channel) {
		if (channel && channel.length > 0) {
			chaincodeName = chaincodeName + '/' + channel;
		}
		return await this.handler.handleInvokeChaincode(chaincodeName, args, this.txId);
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
		validateCompositeKeyAttribute(objectType);
		if (!Array.isArray(attributes)) {
			throw new Error('attributes must be an array');
		}

		let compositeKey = COMPOSITEKEY_NS + objectType + MIN_UNICODE_RUNE_VALUE;
		attributes.forEach((attribute) => {
			validateCompositeKeyAttribute(attribute);
			compositeKey = compositeKey + attribute + MIN_UNICODE_RUNE_VALUE;
		});
		return compositeKey;
	}

	/**
	 * Split a composite key
	 * @param {string} compositeKey the composite key to split
	 * @return {object} which has properties of 'objectType' and attributes
	 */
	splitCompositeKey(compositeKey) {
		let result = {objectType: null, attributes: []};
		if (compositeKey && compositeKey.length > 1 && compositeKey.charAt(0) === COMPOSITEKEY_NS) {
			let splitKey = compositeKey.substring(1).split(MIN_UNICODE_RUNE_VALUE);
			if (splitKey[0]) {
				result.objectType = splitKey[0];
				splitKey.pop();
				if (splitKey.length > 1) {
					splitKey.shift();
					result.attributes = splitKey;
				}
			}
		}
		return result;
	}

	/**
	 * Return the various values for a partial key
	 * @param {string} objectType
	 * @param {array} attributes
	 * @return {promise} a promise that resolves with the returned values, rejects if an error occurs
	 */
	async getStateByPartialCompositeKey(objectType, attributes) {
		let partialCompositeKey = this.createCompositeKey(objectType, attributes);
		return await this.getStateByRange(partialCompositeKey, partialCompositeKey + MAX_UNICODE_RUNE_VALUE);
	}
};

module.exports = ChaincodeStub;
module.exports.RESPONSE_CODE = RESPONSE_CODE;


