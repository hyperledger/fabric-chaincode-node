/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const grpc = require('@grpc/grpc-js');

const {ChaincodeMessageHandler} = require('./handler');
const {peer} = require('@hyperledger/fabric-protos');
const logger = require('./logger').getLogger('lib/server.js');

/**
 * The ChaincodeServer class represents a chaincode gRPC server, which waits for connections from peers.
 */
class ChaincodeServer {
    constructor(chaincode, serverOpts) {
        // Validate arguments
        if (typeof chaincode !== 'object' || chaincode === null) {
            throw new Error('Missing required argument: chaincode');
        }
        if (typeof serverOpts !== 'object' || serverOpts === null) {
            throw new Error('Missing required argument: serverOpts');
        }
        if (typeof chaincode.Init !== 'function' || typeof chaincode.Invoke !== 'function') {
            throw new Error('The "chaincode" argument must implement Init() and Invoke() methods');
        }
        if (typeof serverOpts.ccid !== 'string') {
            throw new Error('Missing required property in serverOpts: ccid');
        }
        if (typeof serverOpts.address !== 'string') {
            throw new Error('Missing required property in serverOpts: address');
        }
        if (typeof serverOpts.tlsProps === 'object' && serverOpts.tlsProps !== null) {
            if (typeof serverOpts.tlsProps.key !== 'object' || serverOpts.tlsProps.key === null) {
                throw new Error('Missing required property in serverOpts.tlsProps: key');
            }
            if (typeof serverOpts.tlsProps.cert !== 'object' || serverOpts.tlsProps.cert === null) {
                throw new Error('Missing required property in serverOpts.tlsProps: cert');
            }

            let clientCACerts;
            if (typeof serverOpts.tlsProps.clientCACerts === 'object' && serverOpts.tlsProps.clientCACerts !== null) {
                clientCACerts = serverOpts.tlsProps.clientCACerts;
            } else {
                clientCACerts = null;
            }

            this._credentials = grpc.ServerCredentials.createSsl(clientCACerts, [
                {
                    private_key: serverOpts.tlsProps.key,
                    cert_chain: serverOpts.tlsProps.cert
                }
            ], clientCACerts === null ? false : true);
        } else {
            this._credentials = grpc.ServerCredentials.createInsecure();
        }

        const grpcOptions = Object.fromEntries(
            Object.entries(serverOpts).filter(([key]) => key.startsWith('grpc.'))
        );

        // Create GRPC Server and register RPC handler
        this._server = new grpc.Server(grpcOptions);
        this._server.addService(peer.ChaincodeService, this);

        this._serverOpts = serverOpts;
        this._chaincode = chaincode;
    }

    start() {
        return new Promise((resolve, reject) => {
            logger.debug('ChaincodeServer trying to bind to ' + this._serverOpts.address);

            this._server.bindAsync(this._serverOpts.address, this._credentials, (error, port) => {
                if (!error) {
                    logger.debug('ChaincodeServer successfully bound to ' + port);

                    this._server.start();
                    logger.debug('ChaincodeServer started.');

                    resolve();
                } else {
                    logger.error('ChaincodeServer failed to bind to ' + this._serverOpts.address);
                    reject(error);
                }
            });
        });
    }

    connect(stream) {
        logger.debug('ChaincodeServer.connect called.');

        try {
            const client = new ChaincodeMessageHandler(stream, this._chaincode);

            const msgPb = new peer.ChaincodeID();
            msgPb.setName(this._serverOpts.ccid);

            const registerMsg = new peer.ChaincodeMessage();
            registerMsg.setType(peer.ChaincodeMessage.Type.REGISTER);
            registerMsg.setPayload(msgPb.serializeBinary());

            logger.debug('Start chatting with a peer through a new stream. Chaincode ID = ' + this._serverOpts.ccid);
            client.chat(registerMsg);
        } catch (e) {
            logger.warn('connection from peer failed: ' + e);
        }
    }
}

module.exports = ChaincodeServer;
