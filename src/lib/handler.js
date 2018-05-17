/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

process.env.GRPC_SSL_CIPHER_SUITES = 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384';

const grpc = require('grpc');
const { URL } = require('url');
const path = require('path');
const util = require('util');
const StateQueryIterator = require('./iterators').StateQueryIterator;
const HistoryQueryIterator = require('./iterators').HistoryQueryIterator;

const logger = require('./logger').getLogger('lib/handler.js');
const Stub = require('./stub.js');
const shim = require('./chaincode.js');

const _serviceProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode_shim.proto'
}).protos;

const _chaincodeProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/chaincode.proto'
}).protos;

const _responseProto = grpc.load({
	root: path.join(__dirname, './protos'),
	file: 'peer/proposal_response.proto'
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
	TRANSACTION: 'TRANSACTION',	// _serviceProto.ChaincodeMessage.Type.TRANSACTION
	COMPLETED: 'COMPLETED',		// _serviceProto.ChaincodeMessage.Type.COMPLETED
};

/*
 * Simple class to represent a message to be queued with the associated
 * promise methods to be driven around this message
 */
class QMsg {
	constructor(msg, method, resolve, reject) {
		this.msg = msg;
		this.method = method;
		this.resolve = resolve;
		this.reject = reject;
	}

	getMsg() {
		return this.msg;
	}

	getMsgTxContextId() {
		return this.msg.channel_id + this.msg.txid;
	}

	getMethod() {
		return this.method;
	}

	success(response) {
		this.resolve(response);
	}

	fail(err) {
		this.reject(err);
	}
}


/*
 * This class handles queuing messages to be sent to the peer based on transaction id
 * The peer can access requests coming from different transactions concurrently but
 * cannot handle concurrent requests for the same transaction. Given the nature of asynchronouse
 * programming this could present a problem so this implementation provides a way to allow
 * code to perform concurrent request by serialising the calls to the peer.
 */
class MsgQueueHandler {
	constructor(handler) {
		this.handler = handler;
		this.stream = handler._stream;
		this.txQueues = {};
	}

	/*
	 * Queue a message to be sent to the peer. If it is the first
	 * message on the queue then send the message to the peer
	 *
	 * @param {QMsg} qMsg the message to queue
	 */
	queueMsg(qMsg) {
		let txContextId = qMsg.getMsgTxContextId();
		let msgQueue = this.txQueues[txContextId];
		if (!msgQueue) {
			msgQueue = this.txQueues[txContextId] = [];
		}

		msgQueue.push(qMsg);
		if (msgQueue.length === 1) {
			this._sendMsg(txContextId);
		}
	}

	/*
	 * Handle a response to a message. this looks at the top of
	 * the queue for the specific txn id to get the message this
	 * response is associated with so it can drive the promise waiting
	 * on this message response. it then removes that message from the
	 * queue and sends the next message on the queue if there is one.
	 *
	 * @param {any} response the received response
	 */
	handleMsgResponse(response) {
		let txId = response.txid;
		let channel_id = response.channel_id;
		let txContextId = channel_id + txId;
		let qMsg = this._getCurrentMsg(txContextId);
		if (qMsg) {
			try {
				let parsedResponse = parseResponse(this.handler, response, qMsg.getMethod());
				qMsg.success(parsedResponse);
			}
			catch(err) {
				qMsg.fail(err);
			}
			this._removeCurrentAndSendNextMsg(txContextId);
		}
	}

	/**
	 * Get the current message.
	 * this returns the message at the top of the queue for the particular transaction.
	 *
	 * @param {string} txContextId - the transaction context id
	 * @returns {QMsg} the message at the top of the queue
	 */
	_getCurrentMsg(txContextId) {
		let msgQueue = this.txQueues[txContextId];
		if (msgQueue) {
			return msgQueue[0];
		}
		let errMsg = util.format('Failed to find a message for transaction context id %s', txContextId);
		logger.error(errMsg);
		//Throwing an error here will terminate the container and potentially lose logs
		//This may be an error, but I don't know if this should abend the container or
		//should just keep going.
		//throw new Error(errMsg);
	}

	/**
	 * Remove the current message and send the next message in the queue if there is one.
	 * delete the queue if there are no more messages.
	 *
	 * @param {any} txContextId - the transaction context id
	 */
	_removeCurrentAndSendNextMsg(txContextId) {
		let msgQueue = this.txQueues[txContextId];
		if (msgQueue && msgQueue.length > 0) {
			msgQueue.shift();
			if (msgQueue.length === 0) {
				delete this.txQueues[txContextId];
			} else {
				this._sendMsg(txContextId);
			}
		}
	}

	/**
	 * send the current message to the peer.
	 *
	 * @param {any} txContextId the transaction context id
	 */
	_sendMsg(txContextId) {
		let qMsg = this._getCurrentMsg(txContextId);
		if (qMsg) {
			try {
				this.stream.write(qMsg.getMsg());
			}
			catch(err) {
				qMsg.fail(err);
			}
		}
	}
}


/*
 * The ChaincodeSupportClient class represents a the base class for all remote nodes, Peer, Orderer , and MemberServicespeer.
 */
class ChaincodeSupportClient {

	/*
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
		if (typeof chaincode !== 'object') {
			throw new Error('Missing required argument: chaincode');
		}

		if (typeof chaincode.Init !== 'function') {
			throw new Error('The chaincode argument must implement the mandatory "Init()" method');
		}

		if (typeof chaincode.Invoke !== 'function') {
			throw new Error('The chaincode argument must implement the mandatory "Invoke()" method');
		}

		this.chaincode = chaincode;

		// connection options
		this._options = {};
		if (opts && opts['ssl-target-name-override'] && opts['ssl-target-name-override'] !== '') {
			this._options['grpc.ssl_target_name_override'] = opts['ssl-target-name-override'];
			this._options['grpc.default_authority'] = opts['ssl-target-name-override'];
		}

		for (let key in opts ? opts : {}) {
			if (key !== 'pem' && key !== 'ssl-target-name-override') {
				this._options[key] = opts[key];
			}
		}

		// service connection
		this._url = url;
		this._endpoint = new Endpoint(url, opts);

		// node.js based timeout
		this._request_timeout = 30000;
		if(opts && opts['request-timeout']) {
			this._request_timeout = opts['request-timeout'];
		}
		this._client = new _serviceProto.ChaincodeSupport(this._endpoint.addr, this._endpoint.creds, this._options);
	}

	close() {
		this._stream.end();
	}

	// this is a long-running method that does not return until
	// the conversation b/w the chaincode program and the target
	// peer has been completed
	chat(convStarterMsg) {
		this._stream = this._client.register();
		this.msgQueueHandler = new MsgQueueHandler(this);

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

					if (type === MSG_TYPE.RESPONSE || type === MSG_TYPE.ERROR) {
						logger.debug('[%s-%s]Received %s,  handling good or error response', msg.channel_id, shortTxid(msg.txid), msg.type);
						self.msgQueueHandler.handleMsgResponse(msg);
					} else if (type === MSG_TYPE.INIT) {
						logger.debug('[%s-%s]Received %s, initializing chaincode', msg.channel_id, shortTxid(msg.txid), msg.type);
						self.handleInit(msg);
					} else if (type === MSG_TYPE.TRANSACTION) {
						logger.debug('[%s-%s]Received %s, invoking transaction on chaincode(state:%s)', msg.channel_id, shortTxid(msg.txid), msg.type, state);
						self.handleTransaction(msg);
					} else {
						logger.error('Received unknown message from the peer. Exiting.');
						//TODO: Should we really do this ?
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
			logger.error('Chat stream with peer - on error: %j', err.stack ? err.stack : err);
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

	async handleGetState(collection, key, channel_id, txId) {
		let payload = new _serviceProto.GetState();
		payload.setKey(key);
		payload.setCollection(collection);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.GET_STATE,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};
		logger.debug('handleGetState - with key:',key);
		return await this._askPeerAndListen(msg, 'GetState');
	}

	async handlePutState(collection, key, value, channel_id, txId) {
		let payload = new _serviceProto.PutState();
		payload.setKey(key);
		payload.setValue(value);
		payload.setCollection(collection);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.PUT_STATE,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};

		return await this._askPeerAndListen(msg, 'PutState');
	}

	async handleDeleteState(collection, key, channel_id, txId) {
		let payload = new _serviceProto.DelState();
		payload.setKey(key);
		payload.setCollection(collection);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.DEL_STATE,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};

		return await this._askPeerAndListen(msg, 'DeleteState');
	}

	async handleGetStateByRange(collection, startKey, endKey, channel_id, txId) {
		let payload = new _serviceProto.GetStateByRange();
		payload.setStartKey(startKey);
		payload.setEndKey(endKey);
		payload.setCollection(collection);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.GET_STATE_BY_RANGE,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};

		return await this._askPeerAndListen(msg, 'GetStateByRange');
	}

	async handleQueryStateNext(id, channel_id, txId) {
		let payload = new _serviceProto.QueryStateNext();
		payload.setId(id);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.QUERY_STATE_NEXT,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id
		};
		return await this._askPeerAndListen(msg, 'QueryStateNext');
	}

	async handleQueryStateClose(id, channel_id, txId) {
		let payload = new _serviceProto.QueryStateClose();
		payload.setId(id);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.QUERY_STATE_CLOSE,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};
		return await this._askPeerAndListen(msg, 'QueryStateClose');
	}

	async handleGetQueryResult(collection, query, channel_id, txId) {
		let payload = new _serviceProto.GetQueryResult();
		payload.setQuery(query);
		payload.setCollection(collection);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.GET_QUERY_RESULT,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};
		return await this._askPeerAndListen(msg, 'GetQueryResult');
	}

	async handleGetHistoryForKey(key, channel_id, txId) {
		let payload = new _serviceProto.GetHistoryForKey();
		payload.setKey(key);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.GET_HISTORY_FOR_KEY,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};
		return await this._askPeerAndListen(msg, 'GetHistoryForKey');
	}

	async handleInvokeChaincode(chaincodeName, args, channel_id, txId) {
		let payload = new _chaincodeProto.ChaincodeSpec();
		let chaincodeId = new _chaincodeProto.ChaincodeID();
		let chaincodeInput = new _chaincodeProto.ChaincodeInput();
		chaincodeId.setName(chaincodeName);
		let inputArgs = [];
		args.forEach((arg) => {
			inputArgs.push(Buffer.from(arg, 'utf8'));
		});
		chaincodeInput.setArgs(inputArgs);
		payload.setChaincodeId(chaincodeId);
		payload.setInput(chaincodeInput);

		let msg = {
			type: _serviceProto.ChaincodeMessage.Type.INVOKE_CHAINCODE,
			payload: payload.toBuffer(),
			txid: txId,
			channel_id: channel_id
		};

		let message = await this._askPeerAndListen(msg, 'InvokeChaincode');
		// here the message type comes back as an enumeration value rather than a string
		// so need to use the enumerated value
		if (message.type === _serviceProto.ChaincodeMessage.Type.COMPLETED) {
			return _responseProto.Response.decode(message.payload);
		}

		// Catch the transaction and rethrow the data
		if (message.type === _serviceProto.ChaincodeMessage.Type.ERROR) {
			const errorData = message.payload.toString('utf8');
			throw new Error(errorData);
		}
	}

	/*
	 * send a message to the peer which returns a promise of the
	 * response.
	 *
	 * @param {string} msg the message to send to the peer
	 * @param {string} method the name of the method being called
	 * @returns {promise} returns a promise which is resolved with the response
	 * or is rejected otherwise
	 */
	_askPeerAndListen(msg, method) {
		return new Promise((resolve, reject) => {
			let qMsg = new QMsg(msg, method, resolve, reject);
			this.msgQueueHandler.queueMsg(qMsg);
		});
	}


	/*
	 * return a printable representation of this object
	 */
	toString() {
		return 'ChaincodeSupportClient : {' +
			'url:' + this._url +
		'}';
	}
}

async function handleMessage(msg, client, action) {
	let nextStateMsg, input;
	try {
		input = _chaincodeProto.ChaincodeInput.decode(msg.payload);
	} catch(err) {
		logger.error('[%s-%s]Incorrect payload format. Sending ERROR message back to peer', msg.channel_id, shortTxid(msg.txid));
		nextStateMsg = {
			type: _serviceProto.ChaincodeMessage.Type.ERROR,
			payload: msg.payload,
			txid: msg.txid,
			channel_id : msg.channel_id
		};
	}

	if (input) {
		let stub;
		try {
			stub = createStub(client, msg.channel_id, msg.txid, input, msg.proposal);
		} catch(err) {
			logger.error(util.format('Failed to construct a chaincode stub instance from the INIT message: %s', err));
			nextStateMsg = {
				type: _serviceProto.ChaincodeMessage.Type.ERROR,
				payload: Buffer.from(err.toString()),
				txid: msg.txid,
				channel_id : msg.channel_id
			};

			client._stream.write(nextStateMsg);
		}

		if (stub) {
			let resp, method;
			if (action === 'init') {
				resp = await client.chaincode.Init(stub);
				method = 'Init';
			} else {
				resp = await client.chaincode.Invoke(stub);
				method = 'Invoke';
			}
			// check that a response object has been returned otherwise assume an error.
			if (!resp || !resp.status) {
				let errMsg = util.format('[%s-%s]Calling chaincode %s() has not called success or error.',
					msg.channel_id, shortTxid(msg.txid), method);
				logger.error(errMsg);
				resp = shim.error(errMsg);
			}

			logger.debug(util.format(
				'[%s-%s]Calling chaincode %s(), response status: %s',
				msg.channel_id, shortTxid(msg.txid),
				method,
				resp.status));

			if (resp.status >= Stub.RESPONSE_CODE.ERROR) {
				let errMsg = util.format('[%s-%s]Calling chaincode %s() returned error response [%s]. Sending ERROR message back to peer',
					msg.channel_id, shortTxid(msg.txid), method, resp.message);
				logger.error(errMsg);

				nextStateMsg = {
					type: _serviceProto.ChaincodeMessage.Type.ERROR,
					payload: Buffer.from('' + resp.message),
					txid: msg.txid,
					channel_id: msg.channel_id
				};
			} else {
				logger.info(util.format('[%s-%s]Calling chaincode %s() succeeded. Sending COMPLETED message back to peer',
					msg.channel_id, shortTxid(msg.txid), method));

				nextStateMsg = {
					type: _serviceProto.ChaincodeMessage.Type.COMPLETED,
					payload: resp.toBuffer(),
					txid: msg.txid,
					channel_id: msg.channel_id,
					chaincode_event: stub.chaincodeEvent
				};
			}

			client._stream.write(nextStateMsg);
		}
	} else {
		client._stream.write(nextStateMsg);
	}
}

/*
 * function to create a new Stub, this is done to facilitate unit testing
 *
 * @param {Handler} client an instance of the Handler class
 * @param {string} channel_id channel id
 * @param {string} txid transaction id
 * @param {any} input decoded message from peer
 * @param {any} proposal the proposal
 * @returns a new Stub instance
 */
function createStub(client, channel_id, txid, input, proposal) {
	return new Stub(client, channel_id, txid, input, proposal);
}

function newErrorMsg(msg, state) {
	let errStr = util.format('[%s-%s]Chaincode handler FSM cannot handle message (%s) with payload size (%d) while in state: %s',
		msg.channel_id, msg.txid, msg.type, msg.payload.length, state);

	return {
		type: MSG_TYPE.ERROR,
		payload: Buffer.from(errStr),
		txid: msg.txid,
		channel_id: msg.channel_id
	};
}

function shortTxid(txId) {
	if (txId.length < 8) {
		return txId;
	}

	return txId.substring(0, 8);
}

function parseResponse(handler, res, method) {
	if (res.type === MSG_TYPE.RESPONSE) {
		logger.debug(util.format('[%s-%s]Received %s() successful response', res.channel_id, shortTxid(res.txid), method));

		// some methods have complex responses, decode the protobuf structure
		// before returning to the client code
		switch (method) {
		case 'GetStateByRange':
		case 'GetQueryResult':
			return new StateQueryIterator(handler, res.channel_id, res.txid, _serviceProto.QueryResponse.decode(res.payload));
		case 'GetHistoryForKey':
			return new HistoryQueryIterator(handler, res.channel_id, res.txid, _serviceProto.QueryResponse.decode(res.payload));
		case 'QueryStateNext':
		case 'QueryStateClose':
			return _serviceProto.QueryResponse.decode(res.payload);
		case 'InvokeChaincode':
			return _serviceProto.ChaincodeMessage.decode(res.payload);
		}

		return res.payload;
	} else if (res.type === MSG_TYPE.ERROR) {
		logger.debug(util.format('[%s-%s]Received %s() error response', res.channel_id, shortTxid(res.txid), method));
		throw new Error(res.payload.toString());
	} else {
		let errMsg = util.format(
			'[%s-%s]Received incorrect chaincode in response to the %s() call: type="%s", expecting "RESPONSE"',
			res.channel_id, shortTxid(res.txid), method, res.type);
		logger.debug(errMsg);
		throw new Error(errMsg);
	}
}

module.exports = ChaincodeSupportClient;

//
// The Endpoint class represents a remote grpc or grpcs target
//
class Endpoint {
	constructor(url /*string*/, opts ) {
		let purl = new URL(url);
		let protocol;
		if (purl.protocol) {
			protocol = purl.protocol.toLowerCase().slice(0, -1);
		}
		if (protocol === 'grpc') {
			this.addr = purl.host;
			this.creds = grpc.credentials.createInsecure();
		} else if (protocol === 'grpcs') {
			if(!opts || !opts.pem || !(typeof opts.pem === 'string')) {
				throw new Error('PEM encoded certificate is required.');
			}
			if(!opts.key || !(typeof opts.key === 'string')) {
				throw new Error('encoded Private key is required.');
			}
			if(!opts.cert || !(typeof opts.cert === 'string')) {
				throw new Error('encoded client certificate is required.');
			}
			this.addr = purl.host;
			this.creds = grpc.credentials.createSsl(Buffer.from(opts.pem), Buffer.from(opts.key,'base64'), Buffer.from(opts.cert,'base64'));
		} else {
			let error = new Error();
			error.name = 'InvalidProtocol';
			error.message = 'Invalid protocol: ' + protocol + '.  URLs must begin with grpc:// or grpcs://';
			throw error;
		}
	}
}
