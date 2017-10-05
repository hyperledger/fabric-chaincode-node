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
const Logger = require('./logger');

const logger = Logger.getLogger('lib/chaincode.js');
const Handler = require('./handler.js');
const Stub = require('./stub.js');
const fs = require('fs');

const argsDef = [{
	name: 'peer.address', type: String
}];

let opts = CLIArgs(argsDef, { partial: true });

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

/**
 * @class
 */
class ChaincodeInterface {
	/**
	 * Called during chaincode instantiate and upgrade. This method can be used
	 * to initialize asset states
	 * @param {ChaincodeStub} stub The chaincode stub is implemented by the <code>fabric-shim</code>
	 * library and passed to the ChaincodeInterface calls by the Hyperledger Fabric platform. The stub
	 * encapsulates the APIs between the chaincode implementation and the Fabric peer
	 */
	init(stub) {}

	/**
	 * called throughout the life time of the chaincode to carry out business
	 * transaction logic and effect the asset states
	 * @param {ChaincodeStub} stub The chaincode stub is implemented by the <code>fabric-shim</code>
	 * library and passed to the ChaincodeInterface calls by the Hyperledger Fabric platform. The stub
	 * encapsulates the APIs between the chaincode implementation and the Fabric peer
	 */
	invoke(stub) {}
}

/**
 * @class
 */
class Shim {
	/**
	 * Call this method to start the chaincode process. After constructing a chaincode object,
	 * pass the object to this function which will initiate a request to register the chaincode
	 * with the target peer. The address of the target peer must be provided via a program
	 * argument <code>--peer.address</code>
	 * @param {ChaincodeInterface} chaincode User-provided object that must implement the <code>ChaincodeInterface</code>
	 */
	static start(chaincode) {
		if (typeof chaincode !== 'object' || chaincode === null)
			throw new Error('Missing required argument: chaincode');

		if (typeof chaincode.Init !== 'function')
			throw new Error('The "chaincode" argument must implement the "Init()" method');

		if (typeof chaincode.Invoke !== 'function')
			throw new Error('The "chaincode" argument must implement the "Invoke()" method');

		let url = parsePeerUrl(opts['peer.address']);
		if (isTLS()){
			opts.pem = fs.readFileSync(process.env.CORE_PEER_TLS_ROOTCERT_FILE).toString();

			// the peer enforces mutual TLS, so we must have the client key and cert to proceed
			let keyPath = process.env.CORE_TLS_CLIENT_KEY_PATH;
			let certPath = process.env.CORE_TLS_CLIENT_CERT_PATH;
			if (typeof keyPath !== 'string' || typeof certPath !== 'string') {
				throw new Error('The client key and cert are needed when TLS is enabled, but environment ' +
					'variables specifying the paths to these files are missing');
			}

			opts.key = fs.readFileSync(keyPath).toString();
			opts.cert = fs.readFileSync(certPath).toString();
		}

		logger.debug(opts);
		let client = new Handler(chaincode, url, opts);
		let chaincodeName = process.env.CORE_CHAINCODE_ID_NAME;
		let chaincodeID = new _chaincodeProto.ChaincodeID();
		chaincodeID.setName(chaincodeName);

		logger.info(util.format('Registering with peer %s as chaincode "%s"', opts['peer.address'], chaincodeName));

		client.chat({
			type: _serviceProto.ChaincodeMessage.Type.REGISTER,
			payload: chaincodeID.toBuffer()
		});

		// return the client object to give the calling code
		// a handle to terminate pro-actively by calling client.close()
		return client;
	}

	/**
	 * @typedef {Object} SuccessResponse
	 * @property {number} status Value is always set to 200 to indicate success
	 * @property {Buffer} payload Optional custom content returned by the chaincode
	 */

	/**
	 * Returns a standard response object with status code 200 and an optional payload
	 * @param {Buffer} payload Can be any content the chaincode wish to return to the client
	 * @returns {SuccessResponse}
	 */
	static success(payload) {
		let ret = new _responseProto.Response();
		ret.status = Stub.RESPONSE_CODE.OK;
		ret.payload = payload ? payload : Buffer.from('');

		return ret;
	}

	/**
	 * @typedef {Object} ErrorResponse
	 * @property {number} status Value is always set to 500 to indicate error
	 * @property {string} message Optional error message returned by the chaincode
	 */

	/**
	 * Returns a standard response object with status code 200 and an optional payload
	 * @param {Buffer} msg A message describing the error
	 * @returns {ErrorResponse}
	 */
	static error(msg) {
		let ret = new _responseProto.Response();
		ret.status = Stub.RESPONSE_CODE.ERROR;
		ret.message = msg;

		return ret;
	}

	/**
	 * Returns a log4js logger named after <code>name</code>
	 * @param {string} name Logger name used to label log messages produced by the returned logger
	 * @returns {Object} log4js based logger. See log4js documentation for usage details
	 */
	static newLogger(name) {
		if (!name) {
			name = 'shim';
		}

		return Logger.getLogger(name);
	}
}

function parsePeerUrl(url) {
	if (typeof url === 'undefined' || url === '') {
		throw new Error('The "peer.address" program argument must be set to a legitimate value of <host>:<port>');
	} else {
		if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
			throw new Error('The "peer.address" program argument can not be set to an "http(s)" url, ' +
				'use grpc(s) or omit the protocol');
		} else {
			// if the url has grpc(s) prefix, use it, otherwise decide based on the TLS enablement
			if (url.indexOf('grpc://') !== 0 && url.indexOf('grpcs://') !== 0) {
				if (isTLS())
					url = 'grpcs://' + url;
				else
					url = 'grpc://' + url;
			}
		}
	}

	return url;
}

function isTLS(){
	let tls = process.env.CORE_PEER_TLS_ENABLED;
	return typeof tls === 'string' && tls.toLowerCase() === 'true';
}

module.exports = Shim;
