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
const X509 = require('x509');
const jsrsasign = require('jsrsasign');
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

// special OID used by Fabric to save attributes in x.509 certificates
const FABRIC_CERT_ATTR_OID = '1.2.3.4.5.6.7.8.1';

/**
 * ClientIdentity represents information about the identity that submitted the
 * transaction
 * @class
 */
class ClientIdentity {
	/**
	 * Returns a new instance of ClientIdentity
	 * @param {ChaincodeStub}
	 */
	constructor(stub) {
		this.stub = stub;
		let signingId = stub.getCreator();

		this.mspId = signingId.getMspid();

		let idBytes = signingId.getIdBytes().toBuffer();
		let normalizedCert = normalizeX509(idBytes.toString());
		let cert = X509.parseCert(normalizedCert);
		this.cert = cert;

		this.attrs = {};
		if(cert && cert.extensions && cert.extensions[FABRIC_CERT_ATTR_OID]) {
			let attr_string = cert.extensions[FABRIC_CERT_ATTR_OID];
			let attr_object = JSON.parse(attr_string);
			let attrs = attr_object.attrs;
			this.attrs = attrs;
		}

		// assemble the unique ID based on certificate
		let x = new jsrsasign.X509();
		x.readCertPEM(normalizedCert);
		this.id = `x509::${x.getSubjectString()}::${x.getIssuerString()}`;
	}

	/**
	 * getID returns the ID associated with the invoking identity.  This ID
	 * is guaranteed to be unique within the MSP.
	 * @returns {string} A string in the format: "x509::<subject DN>::<issuer DN>"
	 */
	getID() {
		return this.id;
	}

	/**
	 * Returns the MSP ID of the client
	 * @returns {string}
	 */
	getMSPID() {
		return this.mspId;
	}

	/**
	 * getAttributeValue returns the value of the client's attribute named `attrName`.
	 * If the client possesses the attribute, returns the value of the attribute.
	 * If the client does not possess the attribute, returns null.
	 * @param {string} attrName
	 * @returns {string}
	 */
	getAttributeValue(attrName) {
		let attr = this.attrs[attrName];
		if (attr) return attr;
		else return null;
	}

	/**
	 * assertAttributeValue verifies that the client has the attribute named `attrName`
	 * with a value of `attrValue`; otherwise, returns false.
	 * @param {string} attrName
	 * @param {string} attrValue
	 * @returns {boolean}
	 */
	assertAttributeValue(attrName, attrValue) {
		let attr = this.getAttributeValue(attrName);
		if (attr === null)
			return false;
		else if (attrValue === attr)
			return true;
		else
			return false;
	}

	/**
	 * getX509Certificate returns the X509 certificate associated with the client,
	 * or null if it was not identified by an X509 certificate.
	 * @returns {object}
	 */
	getX509Certificate() {
		return this.cert;
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

/*
 * Make sure there's a start line with '-----BEGIN CERTIFICATE-----'
 * and end line with '-----END CERTIFICATE-----', so as to be compliant
 * with x509 parsers
 */
function normalizeX509(raw) {
	logger.debug(`[normalizeX509]raw cert: ${raw}`);
	var regex = /(\-\-\-\-\-\s*BEGIN ?[^-]+?\-\-\-\-\-)([\s\S]*)(\-\-\-\-\-\s*END ?[^-]+?\-\-\-\-\-)/;
	var matches = raw.match(regex);
	if (!matches || matches.length !== 4) {
		throw new Error('Failed to find start line or end line of the certificate.');
	}

	// remove the first element that is the whole match
	matches.shift();
	// remove LF or CR
	matches = matches.map((element) => {
		return element.trim();
	});

	// make sure '-----BEGIN CERTIFICATE-----' and '-----END CERTIFICATE-----' are in their own lines
	// and that it ends in a new line
	return matches.join('\n') + '\n';
};

module.exports = Shim;
module.exports.ClientIdentity = ClientIdentity;
