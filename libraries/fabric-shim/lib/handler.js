/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';
/* eslint-disable no-useless-escape */
process.env.GRPC_SSL_CIPHER_SUITES = 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-ECDSA-AES256-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384';

const grpc = require('@grpc/grpc-js');
const {peer} = require('@hyperledger/fabric-protos');
const {URL} = require('url');
const util = require('util');
const StateQueryIterator = require('./iterators').StateQueryIterator;
const HistoryQueryIterator = require('./iterators').HistoryQueryIterator;

const logger = require('./logger').getLogger('lib/handler.js');
const Stub = require('./stub.js');

const utils = require('./utils/utils');

const STATES = {
    Created: 'created',
    Established: 'established',
    Ready: 'ready'
};

// message types
const MSG_TYPE = {
    REGISTERED: peer.ChaincodeMessage.Type.REGISTERED,
    READY: peer.ChaincodeMessage.Type.READY,
    RESPONSE: peer.ChaincodeMessage.Type.RESPONSE,
    ERROR: peer.ChaincodeMessage.Type.ERROR,
    INIT: peer.ChaincodeMessage.Type.INIT,
    TRANSACTION: peer.ChaincodeMessage.Type.TRANSACTION,
    COMPLETED: peer.ChaincodeMessage.Type.COMPLETED,
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
        return this.msg.getChannelId() + this.msg.getTxid();
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
        const txContextId = qMsg.getMsgTxContextId();
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
        const txId = response.txid;
        const channel_id = response.channel_id;
        const txContextId = channel_id + txId;
        const qMsg = this._getCurrentMsg(txContextId);
        if (qMsg) {
            try {
                const parsedResponse = parseResponse(this.handler, response, qMsg.getMethod());
                qMsg.success(parsedResponse);
            } catch (err) {
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
        const msgQueue = this.txQueues[txContextId];
        if (msgQueue) {
            return msgQueue[0];
        }
        const errMsg = util.format('Failed to find a message for transaction context id %s', txContextId);
        logger.error(errMsg);
        // Throwing an error here will terminate the container and potentially lose logs
        // This may be an error, but I don't know if this should abend the container or
        // should just keep going.
        // throw new Error(errMsg);
    }

    /**
     * Remove the current message and send the next message in the queue if there is one.
     * delete the queue if there are no more messages.
     *
     * @param {any} txContextId - the transaction context id
     */
    _removeCurrentAndSendNextMsg(txContextId) {
        const msgQueue = this.txQueues[txContextId];
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
        const qMsg = this._getCurrentMsg(txContextId);
        if (qMsg) {
            try {
                this.stream.write(qMsg.getMsg());
            } catch (err) {
                qMsg.fail(err);
            }
        }
    }
}


/*
 * The ChaincodeSupportClient class represents a chaincode gRPC client to the peer.
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

        for (const key in opts ? opts : {}) {
            if (key !== 'pem' && key !== 'ssl-target-name-override') {
                this._options[key] = opts[key];
            }
        }

        // service connection
        this._url = url;
        this._endpoint = new Endpoint(url, opts);

        // node.js based timeout
        this._request_timeout = 30000;
        if (opts && opts['request-timeout']) {
            this._request_timeout = opts['request-timeout'];
        }

        logger.info('Creating new Chaincode Support Client for peer comminications');
        this._client = new peer.ChaincodeSupportClient(this._endpoint.addr, this._endpoint.creds, this._options);

    }

    close() {
        this._stream.end();
    }

    chat(convStarterMsg) {
        this._stream = this._client.register();

        this._handler = new ChaincodeMessageHandler(this._stream, this.chaincode);
        this._handler.chat(mapToChaincodeMessage(convStarterMsg));
    }

    /*
     return a printable representation of this object
     */
    toString() {
        return 'ChaincodeSupportClient : {' +
            'url:' +
            this._url +
            '}';
    }
}

/**
 * The ChaincodeMessageHandler class handles messages between peer and chaincode both in the chaincode server and client model.
 */
class ChaincodeMessageHandler {
    constructor(stream, chaincode) {
        this._stream = stream;
        this.chaincode = chaincode;
    }

    // this is a long-running method that does not return until
    // the conversation b/w the chaincode program and the target
    // peer has been completed
    chat(convStarterMsg) {
        this.msgQueueHandler = new MsgQueueHandler(this);

        const stream = this._stream;

        // the conversation is supposed to follow a certain protocol,
        // if either side spoke out of turn, then we error out and
        // reject that response. The initial state is "created"
        let state = 'created';

        stream.on('data', (msgpb) => {
            const msg = mapFromChaincodeMessage(msgpb);
            logger.debug(util.format('Received chat message from peer: %s, state: %s, type: %s', msg.txid, state, msg.type));
            if (state === STATES.Ready) {
                const type = msg.type;

                if (type !== MSG_TYPE.REGISTERED && type !== MSG_TYPE.READY) {

                    const loggerPrefix = utils.generateLoggingPrefix(msg.channel_id, msg.txid);

                    if (type === MSG_TYPE.RESPONSE || type === MSG_TYPE.ERROR) {
                        logger.debug(util.format('%s Received %s,  handling good or error response', loggerPrefix, msg.type));
                        this.msgQueueHandler.handleMsgResponse(msg);
                    } else if (type === MSG_TYPE.INIT) {
                        logger.debug(util.format('%s Received %s, initializing chaincode', loggerPrefix, msg.type));
                        this.handleInit(msg);
                    } else if (type === MSG_TYPE.TRANSACTION) {
                        logger.debug(util.format('%s Received %s, invoking transaction on chaincode(state:%s)', loggerPrefix, msg.type, state));
                        this.handleTransaction(msg);
                    } else {
                        logger.error('Received unknown message from the peer. Exiting.');
                        // TODO: Should we really do this ?
                        // Yes
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
                    logger.error(util.format('Chaincode is in "established" state, can only ' +
                        'process messages of type "ready", but received "%s"', msg.type));
                    const errMsg = newErrorMsg(msg, state);
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
                    const errMsg = newErrorMsg(msg, state);
                    stream.write(errMsg);
                }
            }
        });

        stream.on('end', () => {
            logger.debug('Chat stream ending');
            stream.end();
        });

        stream.on('error', (err) => {
            logger.error('Chat stream with peer - on error: %j', err.stack ? err.stack : err);
            stream.end();
        });

        // now let's kick off the conversation already!
        logger.debug('Sending chat message', convStarterMsg);
        stream.write(convStarterMsg);
    }

    handleInit(msg) {
        handleMessage(msg, this, 'init');
    }

    handleTransaction(msg) {
        handleMessage(msg, this, 'invoke');
    }

    async handleGetState(collection, key, channel_id, txId) {
        const msgPb = new peer.GetState();
        msgPb.setKey(key);
        msgPb.setCollection(collection);
        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.GET_STATE,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        logger.debug('handleGetState - with key:', key);
        return await this._askPeerAndListen(msg, 'GetState');
    }

    async handlePutState(collection, key, value, channel_id, txId) {
        const msgPb = new peer.PutState();
        msgPb.setKey(key);
        msgPb.setValue(value);
        msgPb.setCollection(collection);
        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.PUT_STATE,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'PutState');
    }

    async handleDeleteState(collection, key, channel_id, txId) {
        const msgPb = new peer.DelState();
        msgPb.setKey(key);
        msgPb.setCollection(collection);
        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.DEL_STATE,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'DeleteState');
    }

    async handlePurgeState(collection, key, channel_id, txId) {
        const msgPb = new peer.PurgePrivateState();
        msgPb.setKey(key);
        msgPb.setCollection(collection);
        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.PURGE_PRIVATE_DATA,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'PurgePrivateState');
    }

    async handlePutStateMetadata(collection, key, metakey, ep, channel_id, txId) {
        const msgPb = new peer.PutStateMetadata();
        msgPb.setCollection(collection);
        msgPb.setKey(key);

        const metaPb = new peer.StateMetadata();
        metaPb.setMetakey(metakey);
        metaPb.setValue(ep);
        msgPb.setMetadata(metaPb);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.PUT_STATE_METADATA,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return this._askPeerAndListen(msg, 'PutStateMetadata');
    }

    async handleGetPrivateDataHash(collection, key, channel_id, txId) {
        const msgPb = new peer.GetState();
        msgPb.setKey(key);
        msgPb.setCollection(collection);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.GET_PRIVATE_DATA_HASH,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'GetPrivateDataHash');
    }

    async handleGetStateMetadata(collection, key, channel_id, txId) {
        const msgPb = new peer.GetStateMetadata();
        msgPb.setKey(key);
        msgPb.setCollection(collection);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.GET_STATE_METADATA,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return this._askPeerAndListen(msg, 'GetStateMetadata');
    }

    async handleGetStateByRange(collection, startKey, endKey, channel_id, txId, metadata) {

        const msgPb = new peer.GetStateByRange();
        msgPb.setStartkey(startKey);
        msgPb.setEndkey(endKey);
        msgPb.setCollection(collection);
        msgPb.setMetadata(metadata);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.GET_STATE_BY_RANGE,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'GetStateByRange');
    }

    async handleQueryStateNext(id, channel_id, txId) {

        const msgPb = new peer.QueryStateNext();
        msgPb.setId(id);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.QUERY_STATE_NEXT,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id
        });
        return await this._askPeerAndListen(msg, 'QueryStateNext');
    }

    async handleQueryStateClose(id, channel_id, txId) {

        const msgPb = new peer.QueryStateClose();
        msgPb.setId(id);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.QUERY_STATE_CLOSE,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'QueryStateClose');
    }

    async handleGetQueryResult(collection, query, metadata, channel_id, txId) {
        const msgPb = new peer.GetQueryResult();
        msgPb.setCollection(collection);
        msgPb.setQuery(query);
        msgPb.setMetadata(metadata);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.GET_QUERY_RESULT,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'GetQueryResult');
    }

    async handleGetHistoryForKey(key, channel_id, txId) {
        const msgPb = new peer.GetHistoryForKey();
        msgPb.setKey(key);
        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.GET_HISTORY_FOR_KEY,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });
        return await this._askPeerAndListen(msg, 'GetHistoryForKey');
    }

    async handleInvokeChaincode(chaincodeName, args, channel_id, txId) {
        const msgPb = new peer.ChaincodeSpec();
        const chaincodeIdPb = new peer.ChaincodeID();
        chaincodeIdPb.setName(chaincodeName);
        msgPb.setChaincodeId(chaincodeIdPb);

        const chaincodeInputPb = new peer.ChaincodeInput();
        chaincodeInputPb.setArgsList(args.map((value) => Buffer.from(value)));
        msgPb.setInput(chaincodeInputPb);

        const msg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.INVOKE_CHAINCODE,
            payload: msgPb.serializeBinary(),
            txid: txId,
            channel_id: channel_id
        });

        // this returns a peer.ChaincodeMessage
        const chaincodeMsg = await this._askPeerAndListen(msg, 'InvokeChaincode');
        const resp = peer.Response.deserializeBinary(chaincodeMsg.getPayload());
        if (chaincodeMsg.getType() === MSG_TYPE.COMPLETED) {
            return {
                status : resp.getStatus(),
                message: resp.getMessage(),
                payload: Buffer.from(resp.getPayload())
            };
        } else {
            throw new Error(resp.getMessage());
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
            const qMsg = new QMsg(msg, method, resolve, reject);
            this.msgQueueHandler.queueMsg(qMsg);
        });
    }

    /*
     return a printable representation of this object
     */
    toString() {
        return 'ChaincodeMessageHandler : {}';
    }
}

// Two helper functions to map to and from the ProtoBuf structures to
// plain JavaScript objects
// in theory these should not be needed; however this was the path of least
// resistence when refactoring to the new ProtoBuf API.
//
function mapToChaincodeMessage(msg) {
    const msgPb = new peer.ChaincodeMessage();
    msgPb.setType(msg.type);
    msgPb.setPayload(msg.payload);
    msgPb.setTxid(msg.txid);
    msgPb.setChannelId(msg.channel_id);
    msgPb.setChaincodeEvent(msg.chaincode_event);
    return msgPb;
}

function mapFromChaincodeMessage(msgPb) {
    return {
        type: msgPb.getType(),
        payload: Buffer.from(msgPb.getPayload_asU8()),
        txid: msgPb.getTxid(),
        channel_id: msgPb.getChannelId(),
        proposal: msgPb.getProposal(),
        chaincode_event: msgPb.getChaincodeEvent()
    };
}


async function handleMessage(msg, client, action) {

    const loggerPrefix = utils.generateLoggingPrefix(msg.channel_id, msg.txid);

    let nextStateMsg, input;
    try {
        input = peer.ChaincodeInput.deserializeBinary(msg.payload);
    } catch (err) {
        logger.error('%s Incorrect payload format. Sending ERROR message back to peer', loggerPrefix);
        nextStateMsg = mapToChaincodeMessage({
            type: peer.ChaincodeMessage.Type.ERROR,
            payload: msg.payload,
            txid: msg.txid,
            channel_id: msg.channel_id
        });

    }

    if (input) {
        let stub;
        try {
            stub = createStub(client, msg.channel_id, msg.txid, input, msg.proposal);
        } catch (err) {
            logger.error(util.format('Failed to construct a chaincode stub instance from the INIT message: %s', err));
            nextStateMsg = mapToChaincodeMessage({
                type: peer.ChaincodeMessage.Type.ERROR,
                payload: Buffer.from(err.toString()),
                txid: msg.txid,
                channel_id: msg.channel_id
            });

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
                const errMsg = util.format('%s Calling chaincode %s() has not called success or error.',
                    loggerPrefix, method);
                logger.error(errMsg);

                resp = {
                    status: Stub.RESPONSE_CODE.ERROR,
                    message: errMsg
                };
            }
            logger.debug(util.format(
                '%s Calling chaincode %s(), response status: %s',
                loggerPrefix,
                method,
                resp.status));

            const respPb = new peer.Response();
            respPb.setMessage(resp.message);
            respPb.setStatus(resp.status);
            respPb.setPayload(resp.payload);

            if (resp.status >= Stub.RESPONSE_CODE.ERROR) {
                const errMsg = util.format('%s Calling chaincode %s() returned error response [%s]. Sending COMPLETED message back to peer',
                    loggerPrefix, method, resp.message);
                logger.error(errMsg);

                nextStateMsg = mapToChaincodeMessage({
                    type: peer.ChaincodeMessage.Type.COMPLETED,
                    payload: respPb.serializeBinary(),
                    txid: msg.txid,
                    channel_id: msg.channel_id,
                    chaincode_event: stub.chaincodeEvent
                });

            } else {
                logger.info(util.format('%s Calling chaincode %s() succeeded. Sending COMPLETED message back to peer',
                    loggerPrefix, method));

                nextStateMsg = mapToChaincodeMessage({
                    type: peer.ChaincodeMessage.Type.COMPLETED,
                    payload: respPb.serializeBinary(),
                    txid: msg.txid,
                    channel_id: msg.channel_id,
                    chaincode_event: stub.chaincodeEvent
                });
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
    const errStr = util.format('[%s-%s] Chaincode handler FSM cannot handle message (%s) with payload size (%d) while in state: %s',
        msg.channel_id, msg.txid, msg.type, msg.payload.length, state);

    return {
        type: MSG_TYPE.ERROR,
        payload: Buffer.from(errStr),
        txid: msg.txid,
        channel_id: msg.channel_id
    };
}

// Note the following handleXXX methods are to handle the *Peers* response to the Chaincode's original
// handleXXX  request
function handleGetQueryResult(handler, res, method) {

    const payload = peer.QueryResponse.deserializeBinary(res.payload);
    const iterator = new StateQueryIterator(handler, res.channel_id, res.txid, payload);
    const result = {iterator};
    if (payload.getMetadata()) {
        logger.debug(util.format('Received metadata for method: %s', method));
        const metadata = peer.QueryResponseMetadata.deserializeBinary(payload.getMetadata());
        result.metadata = {bookmark:metadata.getBookmark(), fetchedRecordsCount: metadata.getFetchedRecordsCount()};
        logger.debug(util.format('metadata: %j', result.metadata));
    }

    return result;
}

function handleGetStateMetadata(payload) {
    const method = 'handleGetStateMetadata';
    logger.debug('%s - get response from peer.', method);
    const decoded = peer.StateMetadataResult.deserializeBinary(payload);
    logger.debug('%s - decoded response:%j', method, decoded);
    const entries = decoded.getEntriesList();
    const metadata = {};

    entries.forEach(entry => {
        metadata[entry.getMetakey()] = entry.getValue();
    });

    logger.debug('%s - metadata: %j', method, metadata);
    return metadata;
}

function handleGetHistoryQueryResult(handler, res) {
    const queryResponse = peer.QueryResponse.deserializeBinary(res.payload);
    return new HistoryQueryIterator(handler, res.channel_id, res.txid, queryResponse);
}

function parseResponse(handler, res, method) {
    const loggerPrefix = utils.generateLoggingPrefix(res.channel_id, res.txid);

    if (res.type === MSG_TYPE.RESPONSE) {
        logger.debug(util.format('%s Received %s() successful response', loggerPrefix, method));

        // some methods have complex responses, decode the protobuf structure
        // before returning to the client code
        switch (method) {
            case 'GetStateByRange':
            case 'GetQueryResult':
                return handleGetQueryResult(handler, res, method);
            case 'GetHistoryForKey':
                return handleGetHistoryQueryResult(handler, res);
            case 'QueryStateNext':
            case 'QueryStateClose':
                return peer.QueryResponse.deserializeBinary(res.payload);
            case 'InvokeChaincode': {
                const chaincodeMsg = peer.ChaincodeMessage.deserializeBinary(res.payload);
                return chaincodeMsg;
            }
            case 'GetStateMetadata':
                return handleGetStateMetadata(res.payload);
        }

        return Buffer.from(res.payload);
    } else if (res.type === MSG_TYPE.ERROR) {
        logger.debug(util.format('%s Received %s() error response', loggerPrefix, method));
        throw new Error(res.payload.toString());
    } else {
        const errMsg = util.format(
            '%s Received incorrect chaincode in response to the %s() call: type="%s", expecting "RESPONSE"',
            loggerPrefix, method, res.type);
        logger.debug(errMsg);
        throw new Error(errMsg);
    }
}

module.exports = {
    ChaincodeSupportClient,
    ChaincodeMessageHandler
};

//
// The Endpoint class represents a remote grpc or grpcs target
//
class Endpoint {
    constructor(url /* string*/, opts) {

        const purl = new URL(url);

        if (purl.protocol === 'grpc:') {
            this.addr = purl.host;
            this.creds = grpc.credentials.createInsecure();
        } else if (purl.protocol === 'grpcs:') {
            if (!opts || !opts.pem || !(typeof opts.pem === 'string')) {
                throw new Error('PEM encoded certificate is required.');
            }
            if (!opts.key || !(typeof opts.key === 'string')) {
                throw new Error('encoded Private key is required.');
            }
            if (!opts.cert || !(typeof opts.cert === 'string')) {
                throw new Error('encoded client certificate is required.');
            }
            this.addr = purl.host;
            this.creds = grpc.credentials.createSsl(Buffer.from(opts.pem), Buffer.from(opts.key, 'base64'), Buffer.from(opts.cert, 'base64'));
        } else {
            const error = new Error();
            error.name = 'InvalidProtocol';
            error.message = 'Invalid protocol: ' + purl.protocol + '  URLs must begin with grpc:// or grpcs://';
            throw error;
        }
    }
}
