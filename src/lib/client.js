/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const grpc = require('grpc');
const urlParser = require('url');
const path = require('path');
const util = require('util');

const logger = require('./logger').getLogger('lib/client.js');

var Stub = require('./stub.js');

const _serviceProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode_shim.proto'
}).protos;

const _chaincodeProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode.proto'
}).protos;

const STATES = {
	Created: 'created',
	Established: 'established',
	Ready: 'ready'
};

// message types
const MSG_TYPE = {
	REGISTERED: 'REGISTERED', 	// _serviceProto.ChaincodeMessage.Type.REGISTERED
	READY: 'READY', 			// _serviceProto.ChaincodeMessage.Type.READY
	RESPONSE: 'RESPONSE',		// _serviceProto.ChaincodeMessage.Type.RESPONSE
	ERROR: 'ERROR',				// _serviceProto.ChaincodeMessage.Type.ERROR
	INIT: 'INIT',				// _serviceProto.ChaincodeMessage.Type.INIT
	TRANSACTION: 'TRANSACTION'	// _serviceProto.ChaincodeMessage.Type.TRANSACTION
};

/**
 * The ChaincodeSupportClient class represents a the base class for all remote nodes, Peer, Orderer , and MemberServicespeer.
 *
 * @class
 */
var ChaincodeSupportClient = class {

	/**
	 * Constructs an object with the endpoint configuration settings.
	 *
	 * @param {Object} chaincode The user-supplied object to handle chaincode interface calls Init() and Invoke()
	 * @param {string} url The peer URL with format of 'grpc(s)://host:port'
	 * @param {Object} opts An Object that may contain options to pass to grpcs calls
	 * <br>- pem {string} The certificate file, in PEM format,
	 *    to use with the gRPC protocol (that is, with TransportCredentials).
	 *    Required when using the grpcs protocol.
	 * <br>- ssl-target-name-override {string} Used in test environment only, when the server certificate's
	 *    hostname (in the 'CN' field) does not match the actual host endpoint that the server process runs
	 *    at, the application can work around the client TLS verify failure by setting this property to the
	 *    value of the server certificate's hostname
	 * <br>- any other standard grpc call options will be passed to the grpc service calls directly
	 */
	constructor(chaincode, url, opts) {
		this.chaincode = chaincode;

		var pem = null;
		var ssl_target_name_override = '';
		var default_authority = '';

		if (opts && opts.pem) {
			pem = opts.pem;
		}

		if (opts && opts['ssl-target-name-override']) {
			ssl_target_name_override = opts['ssl-target-name-override'];
			default_authority = opts['ssl-target-name-override'];
		}

		// connection options
		this._options = {};
		if (ssl_target_name_override !== '') {
			this._options['grpc.ssl_target_name_override'] = ssl_target_name_override;
		}

		if (default_authority !== '') {
			this._options['grpc.default_authority'] = default_authority;
		}

		for (let key in opts ? opts : {}) {
			if (opts.hasOwnProperty(key)) {
				if (key !== 'pem' && key !== 'ssl-target-name-override') {
					this._options[key] = opts[key];
				}
			}
		}

		// service connection
		this._url = url;
		this._endpoint = new Endpoint(url, pem);

		// node.js based timeout
		this._request_timeout = 30000;
		if(opts && opts['request-timeout']) {
			this._request_timeout = opts['request-timeout'];
		}

		this._client = new _serviceProto.ChaincodeSupport(this._endpoint.addr, this._endpoint.creds, this._options);
		this._stream = this._client.register();
		this._peerListeners = {};
	}

	// this is a long-running method that does not return until
	// the conversation b/w the chaincode program and the target
	// peer has been completed
	chat(convStarterMsg) {
		let stream = this._stream;
		let self = this;
		// the conversation is supposed to follow a certain protocol,
		// if either side spoke out of turn, then we error out and
		// reject that response. The initial state is "created"
		let state = 'created';

		stream.on('data', function (msg) {
			logger.debug('Received chat message from peer: %j, state: %s', msg, state);

			if (state === STATES.Ready) {
				let type = msg.type;

				if (type !== MSG_TYPE.REGISTERED &&
					type !== MSG_TYPE.READY) {

					if (type === MSG_TYPE.RESPONSE) {
						let cb = self._peerListeners[msg.txid];

						if (cb) {
							cb(msg);
						} else {
							let errMsg = util.format('Failed to find a listener for the peer response with transaction Id %s', msg.txid);
							logger.error(errMsg);
							throw new Error(errMsg);
						}
					} else if (type === MSG_TYPE.ERROR) {
						// TODO: peer has sent error response to a request from the shim
						// use the txId of the message to call the corresponding callback
					} else if (type === MSG_TYPE.INIT) {
						logger.debug('[%s]Received %s, initializing chaincode', shortTxid(msg.txid), msg.type);
						self.handleInit(msg);
					} else if (type === MSG_TYPE.TRANSACTION) {
						logger.debug('[%s]Received %s, invoking transaction on chaincode(state:%s)', shortTxid(msg.txid), msg.type, state);
						self.handleTransaction(msg);
					} else {
						logger.error('Received unknown message from the peer. Exiting.');
						process.exit(1);
					}
				}
			}

			if (state === STATES.Established) {
				if (msg.type === MSG_TYPE.READY) {
					logger.info('Successfully established communication with peer node. State transferred to "ready"');
					state = STATES.Ready;
				} else {
					// can not process any message other than "ready"
					// from the peer when in "established" state
					// send an error message telling the peer about this
					logger.error(util.format('Chaincode is in "ready" state, can only ' +
						'process messages of type "established", but received "%s"', msg.type));
					let errMsg = newErrorMsg(msg, state);
					stream.write(errMsg);
				}
			}

			if (state === STATES.Created) {
				if (msg.type === MSG_TYPE.REGISTERED) {
					logger.info('Successfully registered with peer node. State transferred to "established"');
					state = STATES.Established;
				} else {
					// can not process any message other than "registered"
					// from the peer when in "created" state
					// send an error message telling the peer about this
					logger.error(util.format('Chaincode is in "created" state, can only ' +
						'process messages of type "registered", but received "%s"', msg.type));
					let errMsg = newErrorMsg(msg, state);
					stream.write(errMsg);
				}
			}
		});

		stream.on('end', function () {
			logger.debug('Chat stream ending');
			stream.cancel();
		});

		stream.on('error', function (err) {
			logger.debug('Chat stream with peer - on error: %j', err.stack ? err.stack : err);
			stream.end();
		});

		// now let's kick off the conversation already!
		logger.debug('Sending chat message: %j', convStarterMsg);
		stream.write(convStarterMsg);
	}

	handleInit(msg) {
		handleMessage(msg, this, 'init');
	}

	handleTransaction(msg) {
		handleMessage(msg, this, 'invoke');
	}

	handleGetState(key, txId) {
		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.GET_STATE,
			payload: Buffer.from(key),
			txid: txId
		};

		return this._askPeerAndListen(msg, 'GetState');
	}

	handlePutState(key, value, txId) {
		let payload = new _serviceProto.PutStateInfo();
		payload.setKey(key);
		payload.setValue(value);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.PUT_STATE,
			payload: payload.toBuffer(),
			txid: txId
		};

		return this._askPeerAndListen(msg, 'PutState');
	}

	handleDeleteState(key, txId) {
		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.DEL_STATE,
			payload: Buffer.from(key),
			txid: txId
		};

		return this._askPeerAndListen(msg, 'DeleteState');
	}

	handleGetStateByRange(startKey, endKey, txId) {
		let payload = new _serviceProto.GetStateByRange();
		payload.setStartKey(startKey);
		payload.setEndKey(endKey);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.GET_STATE_BY_RANGE,
			payload: payload.toBuffer(),
			txid: txId
		};

		return this._askPeerAndListen(msg, 'GetStateByRange');
	}

	registerPeerListener(txId, cb) {
		this._peerListeners[txId] = cb;
	}

	removePeerListener(txId) {
		if (this._peerListeners[txId])
			delete this._peerListeners[txId];
	}

	_askPeerAndListen(msg, method) {
		let self = this;
		return new Promise((resolve, reject) => {
			self.registerPeerListener(msg.txid, (res) => {
				self.removePeerListener(msg.txid);
				peerResponded(res, method, resolve, reject);
			});

			self._stream.write(msg);
		});
	}

	/**
	* return a printable representation of this object
	*/
	toString() {
		return 'ChaincodeSupportClient : {' +
			'url:' + this._url +
		'}';
	}
};

function handleMessage(msg, client, action) {
	let nextStateMsg, input;
	try {
		input = _chaincodeProto.ChaincodeInput.decode(msg.payload);
	} catch(err) {
		logger.debug('[%s]Incorrect payload format. Sending ERROR message back to peer', shortTxid(msg.txid));
		nextStateMsg = {
			type: _serviceProto.ChaincodeMessage.Type.ERROR,
			payload: msg.payload,
			txid: msg.txid
		};
	}

	if (input) {
		let stub;
		try {
			stub = new Stub(client, msg.txid, input, msg.proposal);
		} catch(err) {
			logger.error(util.format('Failed to construct a chaincode stub instance from the INIT message: %s', err));
			nextStateMsg = {
				type: _serviceProto.ChaincodeMessage.Type.ERROR,
				payload: Buffer.from(err.toString()),
				txid: msg.txid
			};

			client._stream.write(nextStateMsg);
		}

		if (stub) {
			let promise, method;
			if (action === 'init') {
				promise = client.chaincode.Init(stub);
				method = 'Init';
			} else {
				promise = client.chaincode.Invoke(stub);
				method = 'Invoke';
			}

			promise.then((resp) => {
				logger.debug(util.format(
					'[%s]Calling chaincode %s(), response status: %s',
					shortTxid(msg.txid),
					method,
					resp.status));

				if (resp.status >= Stub.RESPONSE_CODE.ERROR) {
					let errMsg = util.format('[%s]Calling chaincode %s() returned error response [%s]. Sending ERROR message back to peer',
						shortTxid(msg.txid), method, resp.message);
					logger.error(errMsg);

					nextStateMsg = {
						type: _serviceProto.ChaincodeMessage.Type.ERROR,
						payload: Buffer.from(errMsg),
						txid: msg.txid
					};
				} else {
					logger.info(util.format('[%s]Calling chaincode %s() succeeded. Sending COMPLETED message back to peer',
						shortTxid(msg.txid), method));

					nextStateMsg = {
						type: _serviceProto.ChaincodeMessage.Type.COMPLETED,
						payload: resp.toBuffer(),
						txid: msg.txid,
						chaincode_event: stub.chaincodeEvent
					};
				}

				client._stream.write(nextStateMsg);
			});
		}
	} else {
		client._stream.write(nextStateMsg);
	}
}

function newErrorMsg(msg, state) {
	let errStr = util.format('[%s]Chaincode handler FSM cannot handle message (%s) with payload size (%d) while in state: %s',
		msg.txid, msg.type, msg.payload.length, state);

	return {
		type: MSG_TYPE.ERROR,
		payload: Buffer.from(errStr),
		txid: msg.txid
	};
}

function shortTxid(txId) {
	if (txId.length < 8)
		return txId;

	return txId.substring(0, 8);
}

function peerResponded(res, method, resolve, reject) {
	if (res.type === MSG_TYPE.RESPONSE) {
		logger.debug(util.format('[%s]Received %s() successful response', shortTxid(res.txid), method));

		// some methods have complex responses, decode the protobuf structure
		// before returning to the client code
		switch (method) {
		case 'GetStateByRange':
			return resolve(_serviceProto.QueryResponse.decode(res.payload));
		}

		return resolve(res.payload);
	} else if (res.type === MSG_TYPE.ERROR) {
		logger.debug(util.format('[%s]Received %s() error response', shortTxid(res.txid), method));
		return reject(new Error(res.payload.toString()));
	} else {
		let errMsg = util.format(
			'[%s]Received incorrect chaincode in response to the %s() call: type="%s", expecting "RESPONSE"',
			shortTxid(res.txid), method, res.type);
		logger.debug(errMsg);
		return reject(new Error(errMsg));
	}
}

module.exports = ChaincodeSupportClient;

//
// The Endpoint class represents a remote grpc or grpcs target
//
var Endpoint = class {
	constructor(url /*string*/ , pem /*string*/ ) {
		var fs = require('fs'),
			path = require('path');

		var purl = urlParser.parse(url, true);
		var protocol;
		if (purl.protocol) {
			protocol = purl.protocol.toLowerCase().slice(0, -1);
		}
		if (protocol === 'grpc') {
			this.addr = purl.host;
			this.creds = grpc.credentials.createInsecure();
		} else if (protocol === 'grpcs') {
			if(!(typeof pem === 'string')) {
				throw new Error('PEM encoded certificate is required.');
			}
			this.addr = purl.host;
			this.creds = grpc.credentials.createSsl(new Buffer(pem));
		} else {
			var error = new Error();
			error.name = 'InvalidProtocol';
			error.message = 'Invalid protocol: ' + protocol + '.  URLs must begin with grpc:// or grpcs://';
			throw error;
		}
	}
};
