/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it beforeEach afterEach before after */
'use strict';

const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const rewire = require('rewire');

const fabprotos = require('../../bundle');
const grpc = require('@grpc/grpc-js');

const serverPath = '../../lib/server';
let ChaincodeServer = rewire(serverPath);

const mockChaincode = {Init: () => {}, Invoke: () => {}};

describe('ChaincodeServer', () => {
    const tlsKey = Buffer.from(fs.readFileSync(path.join(__dirname, 'test-key.pem')).toString(), 'base64');
    const tlsCert = Buffer.from(fs.readFileSync(path.join(__dirname, 'test-cert.pem')).toString(), 'base64');
    const tlsClientCA = fs.readFileSync(path.join(__dirname, 'test-ca.pem'));

    let grpcServerStub;
    const serverOpts = {
        ccid: 'example-chaincode-id',
        address: '0.0.0.0:9999'
    };
    const serverTLSOpts = {
        ccid: 'example-chaincode-id',
        address: '0.0.0.0:9999',
        tlsProps: {
            // test-cert.pem and test-key.pem are base64-encoded and need to decode to make Buffer
            key: tlsKey,
            cert: tlsCert
        }
    };
    const serverMutualTLSOpts = {
        ccid: 'example-chaincode-id',
        address: '0.0.0.0:9999',
        tlsProps: {
            key: tlsKey,
            cert: tlsCert,
            clientCACerts: tlsClientCA
        }
    };
    const mockCredentials = {type: 'insecure'};
    const mockTLSCredentials = {type: 'secure'};
    let insecureCredentialsStub;
    let sslCredentialsStub;

    let mockGrpcServerInstance;

    beforeEach(() => {
        mockGrpcServerInstance = {
            addService: sinon.stub()
        };

        grpcServerStub = sinon.stub(grpc, 'Server').returns(mockGrpcServerInstance);
        insecureCredentialsStub = sinon.stub(grpc.ServerCredentials, 'createInsecure').returns(mockCredentials);
        sslCredentialsStub = sinon.stub(grpc.ServerCredentials, 'createSsl').returns(mockTLSCredentials);
    });
    afterEach(() => {
        grpcServerStub.restore();
        insecureCredentialsStub.restore();
        sslCredentialsStub.restore();
    });

    describe('constructor', () => {
        it('should create a gRPC server instance and call addService in the constructor', () => {
            const server = new ChaincodeServer(mockChaincode, serverOpts);

            expect(server._chaincode).to.deep.equal(mockChaincode);
            expect(server._serverOpts).to.deep.equal(serverOpts);
            expect(server._credentials).to.deep.equal(mockCredentials);

            expect(insecureCredentialsStub.calledOnce).to.be.true;
        });
        it('should create a gRPC server instance with TLS credentials and call addService in the constructor', () => {
            const server = new ChaincodeServer(mockChaincode, serverTLSOpts);

            expect(server._chaincode).to.deep.equal(mockChaincode);
            expect(server._serverOpts).to.deep.equal(serverTLSOpts);
            expect(server._credentials).to.deep.equal(mockTLSCredentials);

            expect(sslCredentialsStub.calledOnce).to.be.true;

            expect(sslCredentialsStub.firstCall.args[0]).to.be.null;
            expect(sslCredentialsStub.firstCall.args[1]).to.deep.equal([{
                private_key: tlsKey,
                cert_chain: tlsCert
            }]);
            expect(sslCredentialsStub.firstCall.args[2]).to.be.false;
        });
        it('should create a gRPC server instance with mutual TLS credentials and call addService in the constructor', () => {
            const server = new ChaincodeServer(mockChaincode, serverMutualTLSOpts);

            expect(server._chaincode).to.deep.equal(mockChaincode);
            expect(server._serverOpts).to.deep.equal(serverMutualTLSOpts);
            expect(server._credentials).to.deep.equal(mockTLSCredentials);

            expect(sslCredentialsStub.calledOnce).to.be.true;

            expect(sslCredentialsStub.firstCall.args[0]).to.deep.equal(tlsClientCA);
            expect(sslCredentialsStub.firstCall.args[1]).to.deep.equal([{
                private_key: tlsKey,
                cert_chain: tlsCert,
            }]);
            expect(sslCredentialsStub.firstCall.args[2]).to.be.true;
        });

        it('should throw an error when chaincode is missing', () => {
            expect(() => new ChaincodeServer(null, serverOpts)).to.throw('Missing required argument: chaincode');
        });
        it('should throw an error when chaincode implements only Invoke', () => {
            expect(() => new ChaincodeServer({Invoke: sinon.stub()}, serverOpts))
                .to.throw('The "chaincode" argument must implement Init() and Invoke() methods');
        });
        it('should throw an error when chaincode implements only Init', () => {
            expect(() => new ChaincodeServer({Init: sinon.stub()}, serverOpts))
                .to.throw('The "chaincode" argument must implement Init() and Invoke() methods');
        });
        it('should throw an error when serverOpts is missing', () => {
            expect(() => new ChaincodeServer(mockChaincode)).to.throw('Missing required argument: serverOpts');
        });
        it('should throw an error when serverOpts.ccid is missing', () => {
            expect(() => new ChaincodeServer(mockChaincode, {})).to.throw('Missing required property in serverOpts: ccid');
        });
        it('should throw an error when serverOpts.address is missing', () => {
            expect(() => new ChaincodeServer(mockChaincode, {ccid: 'some id'})).to.throw('Missing required property in serverOpts: address');
        });
        it('should throw an error when serverOpts.tlsProps.key is missing', () => {
            expect(() => new ChaincodeServer(mockChaincode, {ccid: 'some id', address: '0.0.0.0:9999', tlsProps: {}})).
                to.throw('Missing required property in serverOpts.tlsProps: key');
        });
        it('should throw an error when serverOpts.tlsProps.cert is missing', () => {
            expect(() => new ChaincodeServer(mockChaincode, {ccid: 'some id', address: '0.0.0.0:9999', tlsProps: {key: Buffer.from('a')}})).
                to.throw('Missing required property in serverOpts.tlsProps: cert');
        });
    });

    describe('start()', () => {
        it('should call bindAsync and start', async () => {
            const server = new ChaincodeServer(mockChaincode, serverOpts);

            server._server = {
                bindAsync: sinon.stub().callsFake((address, credentials, callback) => {
                    callback(null, 9999);
                }),
                start: sinon.stub()
            };

            expect(await server.start()).not.to.throw;
            expect(server._server.bindAsync.calledOnce).to.be.true;

            expect(server._server.bindAsync.firstCall.args[0]).to.equal(serverOpts.address);
            expect(server._server.bindAsync.firstCall.args[1]).to.equal(mockCredentials);
            expect(server._server.start.calledOnce).to.be.true;
        });

        it('should throw if bindAsync fails', async () => {
            const server = new ChaincodeServer(mockChaincode, serverOpts);

            server._server = {
                bindAsync: sinon.stub().callsFake((address, credentials, callback) => {
                    callback('failed to bind', 9999);
                }),
                start: sinon.stub()
            };
            expect(server.start()).to.eventually.be.rejectedWith('failed to bind');
        });
    });

    describe('connect()', () => {
        it('should call connect', () => {
            const mockHandler = {
                chat: sinon.stub()
            };
            const mockHandlerStub = sinon.stub().returns(mockHandler);
            ChaincodeServer.__set__('ChaincodeMessageHandler', mockHandlerStub);

            const server = new ChaincodeServer(mockChaincode, serverOpts);
            const mockStream = {on: sinon.stub(), write: sinon.stub()};
            
            server.connect(mockStream);

            expect(mockHandlerStub.calledOnce).to.be.true;
            expect(mockHandler.chat.calledOnce).to.be.true;

            expect(mockHandler.chat.firstCall.args).to.deep.equal([{
                type: fabprotos.protos.ChaincodeMessage.Type.REGISTER,
                payload: fabprotos.protos.ChaincodeID.encode({
                    name: 'example-chaincode-id'
                }).finish()
            }]);
        });

        it('should not throw even if chat fails', () => {
            const mockHandler = {
                chat: sinon.stub().throws(new Error('Some error from chat'))
            };
            const mockHandlerStub = sinon.stub().returns(mockHandler);
            ChaincodeServer.__set__('ChaincodeMessageHandler', mockHandlerStub);

            const server = new ChaincodeServer(mockChaincode, serverOpts);           
            const mockStream = {on: sinon.stub(), write: sinon.stub()};

            server.connect(mockStream);
            expect(mockHandlerStub.calledOnce).to.be.true;
            expect(mockHandler.chat.calledOnce).to.be.true;
        });
    });
});
