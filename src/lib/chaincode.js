/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const CLIArgs = require('command-line-args');
const grpc = require('grpc');
const path = require('path');
const util = require('util');

const logger = require('./logger').getLogger('lib/chaincode.js');
const Handler = require('./handler.js');
const Stub = require('./stub.js');

const argsDef = [{
	name: 'peer.address', type: String
}];
const opts = CLIArgs(argsDef);

const _chaincodeProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode.proto'
}).protos;

const _serviceProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode_shim.proto'
}).protos;

const _responseProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/proposal_response.proto'
}).protos;

var start = function(chaincode) {
	if (typeof chaincode !== 'object' || chaincode === null)
		throw new Error('Missing required argument: chaincode');

	if (typeof chaincode.Init !== 'function')
		throw new Error('The "chaincode" argument must implement the "Init()" method');

	if (typeof chaincode.Invoke !== 'function')
		throw new Error('The "chaincode" argument must implement the "Invoke()" method');

	let url = opts['peer.address'];
	if (typeof url === 'undefined' || url === '') {
		throw new Error('The "peer.address" program argument must be set to a legitimate value of <host>:<port>');
	} else {
		if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
			throw new Error('The "peer.address" program argument can not be set to an "http(s)" url, ' +
				'use grpc(s) or omit the protocol');
		} else {
			// if the url has grpc(s) prefix, use it, otherwise decide based on the TLS enablement
			if (url.indexOf('grpc://') !== 0 && url.indexOf('grpcs://') !== 0) {
				let tls = process.env.CORE_PEER_TLS_ENABLED;
				if (typeof tls === 'string' && tls.toLowerCase() === 'true')
					url = 'grpcs://' + url;
				else
					url = 'grpc://' + url;
			}
		}
	}

	let client = new Handler(chaincode, url);

	let chaincodeName = process.env.CORE_CHAINCODE_ID_NAME;
	let chaincodeID = new _chaincodeProto.ChaincodeID();
	chaincodeID.setName(chaincodeName);

	logger.info(util.format('Registering with peer %s as chaincode "%s"', opts['peer.address'], chaincodeName));

	client.chat({
		type: _serviceProto.ChaincodeMessage.Type.REGISTER,
		payload: chaincodeID.toBuffer()
	});
};

var success = function(payload) {
	let ret = new _responseProto.Response();
	ret.status = Stub.RESPONSE_CODE.OK;
	ret.payload = payload ? payload : Buffer.from('');

	return ret;
};

var error = function(msg) {
	let ret = new _responseProto.Response();
	ret.status = Stub.RESPONSE_CODE.ERROR;
	ret.message = msg;

	return ret;
};

module.exports.start = start;
module.exports.success = success;
module.exports.error = error;
