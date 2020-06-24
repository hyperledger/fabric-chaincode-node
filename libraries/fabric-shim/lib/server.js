/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');
const path = require('path');

const fabprotos = require('../bundle');
const {ChaincodeMessageHandler} = require('./handler');
const logger = require('./logger').getLogger('lib/server.js');

const PROTO_PATH = path.resolve(__dirname, '..', 'protos', 'peer', 'chaincode_shim.proto');
const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
            path.resolve(__dirname, '..', 'google-protos'),
            path.resolve(__dirname, '..', 'protos')
        ]
    }
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

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

        // Create GRPC Server and register RPC handler
        this._server = new grpc.Server();
        this._server.addService(protoDescriptor.protos.Chaincode.service, this);

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
            const chaincodeID = {
                name: this._serverOpts.ccid
            };

            logger.debug('Start chatting with a peer through a new stream. Chaincode ID = ' + this._serverOpts.ccid);
            client.chat({
                type: fabprotos.protos.ChaincodeMessage.Type.REGISTER,
                payload: fabprotos.protos.ChaincodeID.encode(chaincodeID).finish()
            });
        } catch (e) {
            logger.warn('connection from peer failed: ' + e);
        }
    }
}

module.exports = ChaincodeServer;
