/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const grpc = require('grpc');
const path = require('path');
const util = require('util');

const _commonProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'common/common.proto'
}).common;

const _proposalProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/proposal.proto'
}).protos;

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

var Stub = class {
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
		this.signedProposal = signedProposal;

		if (signedProposal) {
			try {
				this.proposal = _proposalProto.Proposal.decode(signedProposal.proposal_bytes);
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
			} catch(err) {
				throw new Error(util.format('Could not extract the header from the proposal: %s', err));
			}

			let signatureHeader;
			try {
				signatureHeader = _commonProto.SignatureHeader.decode(header.signature_header);
			} catch(err) {
				throw new Error(util.format('Decoding SignatureHeader failed: %s', err));
			}

			let ccpp;
			try {
				ccpp = _proposalProto.ChaincodeProposalPayload.decode(this.proposal.payload);
			} catch(err) {
				throw new Error(util.format('Decoding ChaincodeProposalPayload failed: %s', err));
			}

			this.creator = signatureHeader.creator;
			this.transientMap = ccpp.transientMap;

			// TODO: compute binding based on nonce, creator and epoch
			this.binding = '';
		}
	}

	getArgs() {
		return this.args;
	}

	getTxID() {
		return this.txId;
	}

	getState(key) {
		return this.handler.handleGetState(key, this.txId);
	}
};

module.exports = Stub;
module.exports.RESPONSE_CODE = RESPONSE_CODE;
