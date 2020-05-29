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
const rewire = require('rewire');
const fabprotos = require('../../bundle');
const grpc = require('@grpc/grpc-js');

const serverPath = '../../lib/server';
let ChaincodeServer = rewire(serverPath);

const mockChaincode = {Init: () => {}, Invoke: () => {}};

describe('ChaincodeServer', () => {
    const mockGrpcServerInstance = {
        addService: sinon.stub()
    };
    let grpcServerStub;
    const serverOpts = {
        ccid: 'example-chaincode-id',
        address: '0.0.0.0:9999',
        serverOpts: {}
    };

    beforeEach(() => {
        grpcServerStub = sinon.stub(grpc, 'Server').returns(mockGrpcServerInstance);
    });
    afterEach(() => {
        grpcServerStub.restore();
    });

    describe('constructor', () => {
        it('should create a gRPC server instance and call addService in the constructor', () => {
            const server = new ChaincodeServer(mockChaincode, serverOpts);

            expect(grpcServerStub.calledOnce).to.be.ok;
            expect(server._server).to.deep.equal(mockGrpcServerInstance);
            expect(server._server.addService.calledOnce).to.be.ok;
            expect(server._chaincode).to.deep.equal(mockChaincode);
            expect(server._serverOpts).to.deep.equal(serverOpts);
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
            expect(() => new ChaincodeServer(mockChaincode, {})).to.throw('Missing required property in severOpts: ccid');
        });
        it('should throw an error when serverOpts.address is missing', () => {
            expect(() => new ChaincodeServer(mockChaincode, {ccid: 'some id'})).to.throw('Missing required property in severOpts: address');
        });
    });

    describe('start()', () => {
        const mockCredential = {};
        let insecureCredentialStub;

        beforeEach(() => {
            insecureCredentialStub = sinon.stub(grpc.ServerCredentials, 'createInsecure').returns(mockCredential);
        });
        afterEach(() => {
            insecureCredentialStub.restore();
        });

        it('should call bindAsync and start', async () => {
            const server = new ChaincodeServer(mockChaincode, serverOpts);

            server._server = {
                bindAsync: sinon.stub().callsFake((address, credential, callback) => {
                    callback(null, 9999);
                }),
                start: sinon.stub()
            };

            expect(await server.start()).not.to.throw;
            expect(server._server.bindAsync.calledOnce).to.be.ok;
            expect(server._server.bindAsync.firstCall.args[0]).to.equal(serverOpts.address);
            expect(server._server.bindAsync.firstCall.args[1]).to.equal(mockCredential);
            expect(server._server.start.calledOnce).to.be.ok;
        });

        it('should throw if bindAsync fails', async () => {
            const server = new ChaincodeServer(mockChaincode, serverOpts);

            server._server = {
                bindAsync: sinon.stub().callsFake((address, credential, callback) => {
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

            const serviceImpl = server._server.addService.firstCall.args[1];
            const mockStream = {on: sinon.stub(), write: sinon.stub()};

            expect(serviceImpl.connect(mockStream)).not.to.throw;
            expect(mockHandlerStub.calledOnce).to.be.ok;
            expect(mockHandler.chat.calledOnce).to.be.ok;
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

            const serviceImpl = server._server.addService.firstCall.args[1];
            const mockStream = {on: sinon.stub(), write: sinon.stub()};

            expect(serviceImpl.connect(mockStream)).not.to.throw;
            expect(mockHandlerStub.calledOnce).to.be.ok;
            expect(mockHandler.chat.calledOnce).to.be.ok;
        });
    });
});
