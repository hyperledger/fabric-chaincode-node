/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it beforeEach afterEach before after */
/* eslint-disable no-useless-escape */
'use strict';

const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const rewire = require('rewire');
let Handler = rewire('../../../fabric-shim/lib/handler.js');

const Stub = require('../../../fabric-shim/lib/stub.js');
const MsgQueueHandler = Handler.__get__('MsgQueueHandler');
const QMsg = Handler.__get__('QMsg');
const StateQueryIterator = require('../../../fabric-shim/lib/iterators.js').StateQueryIterator;
const HistoryQueryIterator = require('../../../fabric-shim/lib/iterators.js').HistoryQueryIterator;

const grpc = require('grpc');

const sandbox = sinon.createSandbox();

const mockChaincodeImpl = {
    Init: function() {},
    Invoke: function() {}
};

const mockOpts = {
    pem: 'dummy pem string',
    key: 'dummy key',
    cert: 'dummy cert'
};

const mockPeerAddress = {
    base: 'localhost:7051',
    unsecure: 'grpc://localhost:7051',
    secure: 'grpcs://localhost:7051'
};

describe('Handler', () => {
    describe('QMsg', () => {
        let resolve;
        let reject;

        let qMsg;

        const msg = {
            channel_id: 'theChannelID',
            txid: 'aTx'
        };

        beforeEach(() => {
            resolve = sinon.stub();
            reject = sinon.stub();

            qMsg = new QMsg(msg, 'some method', resolve, reject);
        });

        it ('should set its variables with values passed in the constructor', () => {
            expect(qMsg.msg).to.deep.equal(msg);
            expect(qMsg.method).to.deep.equal('some method');
            expect(qMsg.resolve).to.deep.equal(resolve);
            expect(qMsg.reject).to.deep.equal(reject);
        });

        describe('getMsg', () => {
            it ('should return the value of msg', () => {
                expect(qMsg.getMsg()).to.deep.equal(msg);
            });
        });

        describe('getMsgTxContextId', () => {
            it ('should return the value of msg.channel_id concatenated with msg.txid', () => {
                expect(qMsg.getMsgTxContextId()).to.deep.equal(msg.channel_id + msg.txid);
            });
        });

        describe('getMethod', () => {
            it ('should return the value of method', () => {
                expect(qMsg.getMethod()).to.deep.equal('some method');
            });
        });

        describe('success', () => {
            it ('should call the resolve function', () => {
                qMsg.success('response');

                expect(resolve.calledOnce).to.be.ok;
                expect(resolve.firstCall.args).to.deep.equal(['response']);
            });
        });

        describe('fail', () => {
            it ('should call the reject function', () => {
                qMsg.fail('err');

                expect(reject.calledOnce).to.be.ok;
                expect(reject.firstCall.args).to.deep.equal(['err']);
            });
        });
    });

    describe('MsgQueueHandler', () => {
        const txContextId = 'theChannelIDaTX';

        let mockHandler;
        let qHandler;

        beforeEach(() => {
            mockHandler = {_stream: {write: sinon.stub()}};
            qHandler = new MsgQueueHandler(mockHandler);
        });

        it ('should setup its variables on construction', () => {
            expect(qHandler.handler).to.deep.equal(mockHandler);
            expect(qHandler.stream).to.deep.equal(mockHandler._stream);
            expect(qHandler.txQueues).to.deep.equal({});
        });

        describe('queueMsg', () => {
            const qMsg = {
                getMsgTxContextId: () => {
                    return txContextId;
                }
            };

            let mockSendMsg;

            beforeEach(() => {
                mockSendMsg = sinon.stub(qHandler, '_sendMsg');
            });

            it ('should add message to the queue and call sendMsg and handle when txContentId not in txQueues', () => {
                qHandler.queueMsg(qMsg);

                expect(mockSendMsg.calledOnce).to.be.ok;
                expect(mockSendMsg.firstCall.args).to.deep.equal([txContextId]);
                expect(qHandler.txQueues[txContextId]).to.deep.equal([qMsg]);
            });

            it ('should add message to the queue and not call call sendMsg when txContentId in txQueues and is empty array', () => {
                qHandler.txQueues[txContextId] = [];

                qHandler.queueMsg(qMsg);

                expect(mockSendMsg.calledOnce).to.be.ok;
                expect(mockSendMsg.firstCall.args).to.deep.equal([txContextId]);
                expect(qHandler.txQueues[txContextId]).to.deep.equal([qMsg]);
            });

            it ('should add message to the queue and not call call sendMsg when txContentId in txQueues and already has value in array', () => {
                qHandler.txQueues[txContextId] = ['some qMsg'];

                qHandler.queueMsg(qMsg);

                expect(mockSendMsg.notCalled).to.be.ok;
                expect(qHandler.txQueues[txContextId]).to.deep.equal(['some qMsg', qMsg]);
            });
        });

        describe('handleMsgResponse', () => {
            const saveParseResponse = Handler.__get__('parseResponse');

            const response = {
                channel_id: 'theChannelID',
                txid: 'aTx'
            };

            let qMsg;

            let mockGetCurrMsg;
            let mockRemoveCurrentAndSendNextMsg;

            beforeEach(() => {
                qMsg = {
                    success: sinon.spy(),
                    fail: sinon.spy(),
                    getMethod: () => {
                        return 'some method';
                    }
                };

                mockGetCurrMsg = sinon.stub(qHandler, '_getCurrentMsg').returns(qMsg);
                mockRemoveCurrentAndSendNextMsg = sinon.stub(qHandler, '_removeCurrentAndSendNextMsg');
            });

            afterEach(() => {
                Handler.__set__('parseResponse', saveParseResponse);
                mockGetCurrMsg.restore();
                mockRemoveCurrentAndSendNextMsg.restore();
            });

            it ('should do nothing if qMsg does not exist for txContextId', () => {
                const mockParseResponse = sinon.stub().returns('parsed response');
                Handler.__set__('parseResponse', mockParseResponse);

                mockGetCurrMsg.restore();
                mockGetCurrMsg = sinon.stub(qHandler, '_getCurrentMsg').returns(null);

                qHandler.handleMsgResponse(response);

                expect(mockGetCurrMsg.calledOnce).to.be.ok;
                expect(mockGetCurrMsg.firstCall.args).to.deep.equal([response.channel_id + response.txid]);
                expect(mockParseResponse.notCalled).to.be.ok;
                expect(qMsg.success.notCalled).to.be.ok;
                expect(qMsg.fail.notCalled).to.be.ok;
                expect(mockRemoveCurrentAndSendNextMsg.notCalled).to.be.ok;
            });

            it ('should call qMsg success when parseResponse does not throw an error _removeCurrentAndSendNextMsg', () => {
                const mockParseResponse = sinon.stub().returns('parsed response');
                Handler.__set__('parseResponse', mockParseResponse);

                qHandler.handleMsgResponse(response);

                expect(mockGetCurrMsg.calledOnce).to.be.ok;
                expect(mockGetCurrMsg.firstCall.args).to.deep.equal([response.channel_id + response.txid]);
                expect(mockParseResponse.calledOnce).to.be.ok;
                expect(mockParseResponse.firstCall.args).to.deep.equal([mockHandler, response, 'some method']);
                expect(qMsg.success.calledOnce).to.be.ok;
                expect(qMsg.success.firstCall.args).to.deep.equal(['parsed response']);
                expect(qMsg.fail.notCalled).to.be.ok;
                expect(mockRemoveCurrentAndSendNextMsg.calledOnce).to.be.ok;
                expect(mockRemoveCurrentAndSendNextMsg.firstCall.args).to.deep.equal([response.channel_id + response.txid]);
            });

            it ('should call qMsg fail when parseResponse does throw an error _removeCurrentAndSendNextMsg', () => {
                const err = new Error('parse error');
                const mockParseResponse = sinon.stub().throws(err);
                Handler.__set__('parseResponse', mockParseResponse);

                qHandler.handleMsgResponse(response);

                expect(mockGetCurrMsg.calledOnce).to.be.ok;
                expect(mockGetCurrMsg.firstCall.args).to.deep.equal([response.channel_id + response.txid]);
                expect(mockParseResponse.calledOnce).to.be.ok;
                expect(mockParseResponse.firstCall.args).to.deep.equal([mockHandler, response, 'some method']);
                expect(qMsg.success.notCalled).to.be.ok;
                expect(qMsg.fail.calledOnce).to.be.ok;
                expect(qMsg.fail.firstCall.args).to.deep.equal([err]);
                expect(mockRemoveCurrentAndSendNextMsg.calledOnce).to.be.ok;
                expect(mockRemoveCurrentAndSendNextMsg.firstCall.args).to.deep.equal([response.channel_id + response.txid]);
            });
        });

        describe('_getCurrentMsg', () => {
            it ('should get the message at the top of the queue for a txContextId', () => {
                qHandler.txQueues[txContextId] = ['message1', 'message2'];

                expect(qHandler._getCurrentMsg(txContextId)).to.deep.equal('message1');
            });

            it ('should return undefined when queue is empty for a txContextId', () => {
                qHandler.txQueues[txContextId] = [];

                expect(qHandler._getCurrentMsg(txContextId)).to.be.undefined;
            });

            it ('should return undefined when queue does not exist for a txContextId', () => {
                qHandler.txQueues[txContextId] = null;

                expect(qHandler._getCurrentMsg(txContextId)).to.be.undefined;
            });
        });

        describe('_removeCurrentAndSendNextMsg', () => {
            let sendMsg;

            const alternateTxContextId = 'theChannelIDanotherTX';

            beforeEach(() => {
                sendMsg = sinon.stub(qHandler, '_sendMsg');
                qHandler.txQueues[alternateTxContextId] = ['message3', 'message4'];
            });

            afterEach(() => {
                sendMsg.restore();
            });

            it ('should delete the current message and send the next for a txContentId', () => {
                qHandler.txQueues[txContextId] = ['message1', 'message2'];

                qHandler._removeCurrentAndSendNextMsg(txContextId);

                expect(sendMsg.calledOnce).to.be.ok;
                expect(qHandler.txQueues[txContextId]).to.deep.equal(['message2']);
                expect(qHandler.txQueues[alternateTxContextId]).to.deep.equal(['message3', 'message4']);
            });

            it ('should delete the queue if no messages left after current is deleted for a txContentId', () => {
                qHandler.txQueues[txContextId] = ['message1'];

                qHandler._removeCurrentAndSendNextMsg(txContextId);

                expect(sendMsg.notCalled).to.be.ok;
                expect(qHandler.txQueues[txContextId]).to.be.undefined;
                expect(qHandler.txQueues[alternateTxContextId]).to.deep.equal(['message3', 'message4']);
            });

            it ('should do nothing if no queue is found for a txContentId', () => {
                qHandler.txQueues[txContextId] = null;

                qHandler._removeCurrentAndSendNextMsg(txContextId);

                expect(sendMsg.notCalled).to.be.ok;
                expect(qHandler.txQueues[txContextId]).to.be.null;
                expect(qHandler.txQueues[alternateTxContextId]).to.deep.equal(['message3', 'message4']);
            });
        });

        describe('_sendMsg', () => {
            const mockQMsg = {
                getMsg: () => {
                    return 'some message';
                },
                fail: sinon.spy()
            };

            it ('should do nothing if no QMsg found for a txContextId', () => {
                const getCurrStub = sinon.stub(qHandler, '_getCurrentMsg').returns(null);

                qHandler._sendMsg(txContextId);

                expect(getCurrStub.calledOnce).to.be.ok;
                expect(getCurrStub.firstCall.args).to.deep.equal([txContextId]);
                expect(qHandler.stream.write.notCalled).to.be.ok;
                expect(mockQMsg.fail.notCalled).to.be.ok;
            });

            it ('should write to the stream the current message', () => {
                const getCurrStub = sinon.stub(qHandler, '_getCurrentMsg').returns(mockQMsg);

                qHandler._sendMsg(txContextId);

                expect(getCurrStub.calledOnce).to.be.ok;
                expect(getCurrStub.firstCall.args).to.deep.equal([txContextId]);
                expect(qHandler.stream.write.calledOnce).to.be.ok;
                expect(qHandler.stream.write.firstCall.args).to.deep.equal(['some message']);
                expect(mockQMsg.fail.notCalled).to.be.ok;
            });

            it ('should call fail on the QMsg if stream write errors', () => {
                const err = new Error('some error');
                qHandler.stream.write = sinon.stub().throws(err);

                const getCurrStub = sinon.stub(qHandler, '_getCurrentMsg').returns(mockQMsg);

                qHandler._sendMsg(txContextId);

                expect(getCurrStub.calledOnce).to.be.ok;
                expect(getCurrStub.firstCall.args).to.deep.equal([txContextId]);
                expect(mockQMsg.fail.calledOnce).to.be.ok;
                expect(mockQMsg.fail.firstCall.args).to.deep.equal([err]);
            });
        });
    });

    describe('ChaincodeSupportClient', () => {
        it ('should throw an error when chaincode not passed', () => {
            expect(() => {
                new Handler();
            }).to.throw(/Missing required argument: chaincode/);
        });

        it ('should throw an error if argument does not match chaincode format', () => {
            expect(() => {
                new Handler({});
            }).to.throw(/The chaincode argument must implement the mandatory "Init\(\)" method/);
        });

        it ('should throw an error if argument only part matches chaincode format', () => {
            expect(() => {
                new Handler({
                    Init: function() {}
                });
            }).to.throw(/The chaincode argument must implement the mandatory "Invoke\(\)" method/);
        });

        it ('should throw an error if argument missing URL argument', () => {
            expect(() => {
                new Handler(mockChaincodeImpl);
            }).to.throw(/Invalid URL: undefined/);
        });

        it ('should throw an error if URL argument does not use grpc as protocol', () => {
            expect(() => {
                new Handler(mockChaincodeImpl, 'https://' + mockPeerAddress.base);
            }).to.throw(/Invalid protocol: https. {2}URLs must begin with grpc:\/\/ or grpcs:\/\//);
        });

        it ('should set endpoint, client and default timeout', () => {
            const credsSpy = sinon.spy(grpc.credentials, 'createInsecure');

            const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);

            expect(handler._request_timeout).to.deep.equal(30000);
            expect(handler._endpoint.addr).to.deep.equal(mockPeerAddress.base);
            expect(credsSpy.calledOnce).to.be.ok;
            expect(handler._endpoint.creds.constructor.name).to.deep.equal('ChannelCredentials');
            expect(handler._client.constructor.name).to.deep.equal('ServiceClient');

            credsSpy.restore();
        });

        it ('should override the default request timeout if value passed', () => {
            const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure, {
                'request-timeout': 123456
            });

            expect(handler._request_timeout).to.deep.equal(123456);
        });

        it ('should store additional grpc options', () => {
            const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure, {
                'grpc.max_send_message_length': 1,
                'grpc.max_receive_message_length': 2,
                'grpc.keepalive_time_ms': 3,
                'grpc.http2.min_time_between_pings_ms': 5,
                'grpc.keepalive_timeout_ms': 8,
                'grpc.http2.max_pings_without_data': 13,
                'grpc.keepalive_permit_without_calls': 21
            });

            expect(handler._options['grpc.max_send_message_length']).to.equal(1);
            expect(handler._options['grpc.max_receive_message_length']).to.equal(2);
            expect(handler._options['grpc.keepalive_time_ms']).to.equal(3);
            expect(handler._options['grpc.http2.min_time_between_pings_ms']).to.equal(5);
            expect(handler._options['grpc.keepalive_timeout_ms']).to.equal(8);
            expect(handler._options['grpc.http2.max_pings_without_data']).to.equal(13);
            expect(handler._options['grpc.keepalive_permit_without_calls']).to.equal(21);
        });

        it ('should preserve casing in handler addr', () => {
            const handler = new Handler(mockChaincodeImpl, 'grpc://' + mockPeerAddress.base.toUpperCase());

            expect(handler._endpoint.addr).to.deep.equal(mockPeerAddress.base.toUpperCase());
        });

        it ('should throw an error if connection secure and certificate not passed', () => {
            expect(() => {
                new Handler(mockChaincodeImpl, mockPeerAddress.secure);
            }).to.throw(/PEM encoded certificate is required./);
        });

        it ('should throw an error if connection secure encoded private key not passed as opt', () => {
            expect(() => {
                new Handler(mockChaincodeImpl, mockPeerAddress.secure, {
                    pem: 'dummy pem string'
                });
            }).to.throw(/encoded Private key is required./);
        });

        it ('should throw an error if connection secure encoded private key not passed as opt', () => {
            expect(() => {
                new Handler(mockChaincodeImpl, mockPeerAddress.secure, {
                    pem: 'dummy pem string',
                    key: 'dummy key'
                });
            }).to.throw(/encoded client certificate is required./);
        });

        it ('should set endpoint, client and default timeout for a secure connection', () => {
            const credsSpy = sinon.spy(grpc.credentials, 'createSsl');

            const handler = new Handler(mockChaincodeImpl, mockPeerAddress.secure, mockOpts);

            expect(handler._options.cert).to.deep.equal(mockOpts.cert);
            expect(handler._request_timeout).to.deep.equal(30000);
            expect(handler._endpoint.addr).to.deep.equal(mockPeerAddress.base);
            expect(credsSpy.calledOnce).to.be.ok;
            expect(credsSpy.calledWith(Buffer.from(mockOpts.pem), Buffer.from(mockOpts.key, 'base64'), Buffer.from(mockOpts.cert, 'base64'))).to.be.ok;
            expect(handler._endpoint.creds.constructor.name).to.deep.equal('ChannelCredentials');
            expect(handler._client.constructor.name).to.deep.equal('ServiceClient');
        });

        it ('should set grpc ssl options when ssl-target-name-override passed', () => {
            const opts = Object.assign({}, mockOpts);
            opts['ssl-target-name-override'] = 'dummy override';

            const handler = new Handler(mockChaincodeImpl, mockPeerAddress.secure, opts);

            expect(handler._options['grpc.ssl_target_name_override']).to.deep.equal('dummy override');
            expect(handler._options['grpc.default_authority']).to.deep.equal('dummy override');
        });

        describe('close', () => {
            it ('should call end on the stream', () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                handler._stream = {end: sinon.stub()};

                handler.close();

                expect(handler._stream.end.calledOnce).to.be.ok;
            });
        });

        describe('chat', () => {
            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
            });

            it ('should create instance of MsgQueueHandler, register the client, setup listeners and write', () => {
                const mockMsgQueueHandler = sinon.spy(() => {
                    return sinon.createStubInstance(MsgQueueHandler);
                });

                Handler.__set__('MsgQueueHandler', mockMsgQueueHandler);

                const mockStream = {write: sinon.stub(), on: sinon.stub()};

                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                handler._client.register = sinon.stub().returns(mockStream);

                handler.chat('some starter message');

                expect(handler._client.register.calledOnce).to.be.ok;
                expect(mockMsgQueueHandler.calledWithNew).to.been.ok;
                expect(handler._stream).to.deep.equal(mockStream);
                expect(handler.msgQueueHandler).to.deep.equal(new mockMsgQueueHandler(handler));

                expect(mockStream.write.calledOnce).to.be.ok;
                expect(mockStream.write.firstCall.args).to.deep.equal(['some starter message']);
                expect(mockStream.on.callCount).to.deep.equal(3);
                expect(mockStream.on.firstCall.args[0]).to.deep.equal('data');
                expect(mockStream.on.secondCall.args[0]).to.deep.equal('end');
                expect(mockStream.on.thirdCall.args[0]).to.deep.equal('error');
            });

            describe('stream.on.data', () => {

                const MSG_TYPE = Handler.__get__('MSG_TYPE');

                const registeredMsg = {
                    type: MSG_TYPE.REGISTERED
                };

                const establishedMsg = {
                    type: MSG_TYPE.READY
                };

                const eventReg = {};
                const mockEventEmitter = (event, cb) => {
                    eventReg[event] = cb;
                };

                let mockStream;
                let mockNewErrorMsg;

                let handler;

                let mockMsgQueueHandler;

                let handleMsgResponseSpy;
                let handleInitSpy;
                let handleTransactionSpy;

                beforeEach(() => {

                    handleMsgResponseSpy = sinon.spy();

                    mockMsgQueueHandler = sinon.spy(() => {
                        const mock = sinon.createStubInstance(MsgQueueHandler);
                        mock.handleMsgResponse = handleMsgResponseSpy;

                        return mock;
                    });

                    mockNewErrorMsg = sinon.stub().returns('some error');

                    Handler.__set__('MsgQueueHandler', mockMsgQueueHandler);
                    Handler.__set__('newErrorMsg', mockNewErrorMsg);

                    mockStream = {write: (sinon.stub()), on: mockEventEmitter, cancel: sinon.stub(), end: sinon.stub()};

                    handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                    handler._client.register = sinon.stub().returns(mockStream);
                    handler.chat('some starter message');

                    handleInitSpy = sinon.spy();
                    handleTransactionSpy = sinon.spy();

                    handler.handleInit = handleInitSpy;
                    handler.handleTransaction = handleTransactionSpy;
                });

                it ('should throw error when in state created and MSG_TYPE not REGISTERED', () => {
                    const badRegisteredMsg = {
                        type: 'NOT REGISTERED'
                    };

                    eventReg.data(badRegisteredMsg);

                    expect(mockStream.write.calledTwice).to.be.ok;
                    expect(mockNewErrorMsg.calledOnce).to.be.ok;
                    expect(mockStream.write.secondCall.args).to.deep.equal(['some error']);
                    expect(mockNewErrorMsg.firstCall.args).to.deep.equal([badRegisteredMsg, 'created']);
                });

                it ('should throw error when in state established and MSG_TYPE not READY', () => {
                    const badEstablishedMsg = {
                        type: 'NOT REGISTERED'
                    };

                    eventReg.data(registeredMsg);
                    eventReg.data(badEstablishedMsg);

                    expect(mockStream.write.calledTwice).to.be.ok;
                    expect(mockNewErrorMsg.calledOnce).to.be.ok;
                    expect(mockStream.write.secondCall.args).to.deep.equal(['some error']);
                    expect(mockNewErrorMsg.firstCall.args).to.deep.equal([badEstablishedMsg, 'established']);
                });

                it ('should do nothing when in state ready and MSG_TYPE equals REGISTERED', () => {
                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);
                    eventReg.data(registeredMsg);

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.notCalled).to.be.ok;
                    expect(handleInitSpy.notCalled).to.be.ok;
                    expect(handleTransactionSpy.notCalled).to.be.ok;
                });

                it ('should do nothing when in state ready and MSG_TYPE equals READY', () => {
                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);
                    eventReg.data(establishedMsg);

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.notCalled).to.be.ok;
                    expect(handleInitSpy.notCalled).to.be.ok;
                    expect(handleTransactionSpy.notCalled).to.be.ok;
                });

                it ('should call handleMsgResponse when in state ready and MSG_TYPE equals RESPONSE', () => {
                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);

                    const readyMsg = {
                        type: MSG_TYPE.RESPONSE,
                        channel_id: 'some channel',
                        txid: 'some tx id'
                    };

                    eventReg.data(readyMsg);

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.calledOnce).to.be.ok;
                    expect(handleMsgResponseSpy.firstCall.args).to.deep.equal([readyMsg]);
                    expect(handleInitSpy.notCalled).to.be.ok;
                    expect(handleTransactionSpy.notCalled).to.be.ok;
                });

                it ('should call handleMsgResponse when in state ready and MSG_TYPE equals ERROR', () => {
                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);

                    const readyMsg = {
                        type: MSG_TYPE.ERROR,
                        channel_id: 'some channel',
                        txid: 'some tx id'
                    };

                    eventReg.data(readyMsg);

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.calledOnce).to.be.ok;
                    expect(handleMsgResponseSpy.firstCall.args).to.deep.equal([readyMsg]);
                    expect(handleInitSpy.notCalled).to.be.ok;
                    expect(handleTransactionSpy.notCalled).to.be.ok;
                });

                it ('should call handleInit when in state ready and MSG_TYPE equals INIT', () => {
                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);

                    const readyMsg = {
                        type: MSG_TYPE.INIT,
                        channel_id: 'some channel',
                        txid: 'some tx id'
                    };

                    eventReg.data(readyMsg);
                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.notCalled).to.be.ok;
                    expect(handleInitSpy.calledOnce).to.be.ok;
                    expect(handleInitSpy.firstCall.args).to.deep.equal([readyMsg]);
                    expect(handleTransactionSpy.notCalled).to.be.ok;
                });

                it ('should call handleTransaction when in state ready and MSG_TYPE equals TRANSACTION', () => {
                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);

                    const readyMsg = {
                        type: MSG_TYPE.TRANSACTION,
                        channel_id: 'some channel',
                        txid: 'some tx id'
                    };

                    eventReg.data(readyMsg);
                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.notCalled).to.be.ok;
                    expect(handleInitSpy.notCalled).to.be.ok;
                    expect(handleTransactionSpy.calledOnce).to.be.ok;
                    expect(handleTransactionSpy.firstCall.args).to.deep.equal([readyMsg]);
                });

                it ('should end the process with value 1', () => {
                    const processStub = sinon.stub(process, 'exit');

                    eventReg.data(registeredMsg);
                    eventReg.data(establishedMsg);

                    const readyMsg = {
                        type: 'something else',
                        channel_id: 'some channel',
                        txid: 'some tx id'
                    };

                    eventReg.data(readyMsg);
                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockNewErrorMsg.notCalled).to.be.ok;
                    expect(handleMsgResponseSpy.notCalled).to.be.ok;
                    expect(handleInitSpy.notCalled).to.be.ok;
                    expect(handleTransactionSpy.notCalled).to.be.ok;
                    expect(processStub.calledOnce).to.be.ok;
                    expect(processStub.firstCall.args).to.deep.equal([1]);

                    processStub.restore();
                });
            });

            describe('stream.on.end', () => {
                it ('should cancel the stream', () => {
                    const eventReg = {};
                    const mockEventEmitter = (event, cb) => {
                        eventReg[event] = cb;
                    };

                    const mockStream = {write: sinon.stub(), on: mockEventEmitter, cancel: sinon.stub(), end: sinon.stub()};

                    const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                    handler._client.register = sinon.stub().returns(mockStream);
                    handler.chat('some starter message');

                    eventReg.end();

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockStream.cancel.calledOnce).to.be.ok;
                });
            });

            describe('stream.on.error', () => {
                it ('should end the stream', () => {
                    const eventReg = {};
                    const mockEventEmitter = (event, cb) => {
                        eventReg[event] = cb;
                    };

                    const mockStream = {write: sinon.stub(), on: mockEventEmitter, end: sinon.stub()};

                    const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                    handler._client.register = sinon.stub().returns(mockStream);
                    handler.chat('some starter message');

                    eventReg.error({});

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockStream.end.calledOnce).to.be.ok;
                });
                it ('should end the  with error', () => {
                    const eventReg = {};
                    const mockEventEmitter = (event, cb) => {
                        eventReg[event] = cb;
                    };

                    const mockStream = {write: sinon.stub(), on: mockEventEmitter, end: sinon.stub()};

                    const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                    handler._client.register = sinon.stub().returns(mockStream);
                    handler.chat('some starter message');
                    const error = new Error();
                    eventReg.error(error);

                    expect(mockStream.write.calledOnce).to.be.ok;
                    expect(mockStream.end.calledOnce).to.be.ok;
                });
            });
        });

        describe('handleInit', () => {
            it ('should call handleMessage', () => {
                const savedHandleMessage = Handler.__get__('handleMessage');

                const handleMessage = sinon.spy();
                Handler.__set__('handleMessage', handleMessage);

                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                handler.handleInit('some message');

                expect(handleMessage.calledOnce).to.be.ok;
                expect(handleMessage.firstCall.args).to.deep.equal(['some message', handler, 'init']);

                Handler.__set__('handleMessage', savedHandleMessage);
            });
        });

        describe('handleTransaction', () => {
            it ('should call handleMessage', () => {
                const savedHandleMessage = Handler.__get__('handleMessage');

                const handleMessage = sinon.spy();
                Handler.__set__('handleMessage', handleMessage);

                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                handler.handleTransaction('some message');

                expect(handleMessage.calledOnce).to.be.ok;
                expect(handleMessage.firstCall.args).to.deep.equal(['some message', handler, 'invoke']);

                Handler.__set__('handleMessage', savedHandleMessage);
            });
        });

        describe('handleGetState', () => {
            const key = 'theKey';
            const collection = '';

            let expectedMsg;
            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetState();
                payload.setKey(key);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_STATE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleGetState(collection, key, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetState');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleGetState(collection, key, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetState');
            });
        });

        describe('handlePutState', () => {
            const key = 'theKey';
            const value = 'some value';
            const collection = 'some collection';

            let expectedMsg;

            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.PutState();
                payload.setKey(key);
                payload.setValue(value);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.PUT_STATE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handlePutState(collection, key, value, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('PutState');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handlePutState(collection, key, value, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('PutState');
            });
        });

        describe('handleDeleteState', () => {
            const key = 'theKey';
            const collection = '';

            let expectedMsg;

            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.DelState();
                payload.setKey(key);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.DEL_STATE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleDeleteState(collection, key, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('DeleteState');
            });

            it ('should reject when _askPeerAndListen rejects', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleDeleteState(collection, key, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('DeleteState');
            });
        });

        describe('handlePutStateMetadata', () => {
            const key = 'theKey';
            const collection = '';
            let expectedMsg;
            const metadataKey = 'VALIDATION_PARAMETER';
            const ep = Buffer.from('theEP');

            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const stateMetadata = new serviceProto.StateMetadata();
                stateMetadata.setMetakey(metadataKey);
                stateMetadata.setValue(ep);

                const payload = new serviceProto.PutStateMetadata();
                payload.setKey(key);
                payload.setCollection(collection);
                payload.setMetadata(stateMetadata);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.PUT_STATE_METADATA,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handlePutStateMetadata(collection, key, metadataKey, ep, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('PutStateMetadata');
            });

            it('should reject when _askPeerAndListen rejects', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handlePutStateMetadata(collection, key, metadataKey, ep, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('PutStateMetadata');
            });
        });

        describe('handleGetPrivateDataHash', () => {
            const key = 'theKey';
            const collection = '';

            let expectedMsg;
            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetState();
                payload.setKey(key);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_PRIVATE_DATA_HASH,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleGetPrivateDataHash(collection, key, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetPrivateDataHash');
            });

            it ('should reject when _askPeerAndListen rejects', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleGetPrivateDataHash(collection, key, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetPrivateDataHash');
            });
        });

        describe('handleGetStateMetadata', () => {
            const key = 'theKey';
            const collection = '';
            let expectedMsg;

            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetStateMetadata();
                payload.setKey(key);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_STATE_METADATA,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleGetStateMetadata(collection, key, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetStateMetadata');
            });

            it('should reject when _askPeerAndListen rejects', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleGetStateMetadata(collection, key, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetStateMetadata');
            });
        });

        describe('handleGetStateByRange', () => {
            const startKey = 'theStartKey';
            const endKey = 'theEndKey';
            const collection = '';

            let expectedMsg;
            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetStateByRange();
                payload.setStartKey(startKey);
                payload.setEndKey(endKey);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_STATE_BY_RANGE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleGetStateByRange(collection, startKey, endKey, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetStateByRange');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleGetStateByRange(collection, startKey, endKey, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetStateByRange');
            });

            it ('should resolve with metadata when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');
                const metadata = Buffer.from('metadata');

                const result = await handler.handleGetStateByRange(collection, startKey, endKey, 'theChannelID', 'theTxID', metadata);

                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetStateByRange();
                payload.setStartKey(startKey);
                payload.setEndKey(endKey);
                payload.setCollection(collection);
                payload.setMetadata(metadata);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_STATE_BY_RANGE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetStateByRange');
            });
        });

        describe('handleQueryStateNext', () => {
            const id = 'theID';

            let expectedMsg;
            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.QueryStateNext();
                payload.setId(id);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.QUERY_STATE_NEXT,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleQueryStateNext(id, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('QueryStateNext');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleQueryStateNext(id, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('QueryStateNext');
            });
        });

        describe('handleQueryStateClose', () => {
            const id = 'theID';

            let expectedMsg;
            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.QueryStateClose();
                payload.setId(id);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.QUERY_STATE_CLOSE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleQueryStateClose(id, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('QueryStateClose');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleQueryStateClose(id, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('QueryStateClose');
            });
        });

        describe('handleGetQueryResult', () => {
            const collection = 'some collection';
            const query = 'some query';

            let expectedMsg;
            let serviceProto;
            before(() => {
                serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetQueryResult();
                payload.setQuery(query);
                payload.setCollection(collection);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_QUERY_RESULT,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleGetQueryResult(collection, query, null, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetQueryResult');
            });

            it ('should reject when _askPeerAndListen rejects', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleGetQueryResult(collection, query, null, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetQueryResult');
            });

            it ('handleGetQueryResult with metadata should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();
                const metadata = Buffer.from('some metadata');

                const result = handler.handleGetQueryResult(collection, query, metadata, 'theChannelID', 'theTxID');
                const payload = new serviceProto.GetQueryResult();
                payload.setQuery(query);
                payload.setCollection(collection);
                payload.setMetadata(metadata);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_QUERY_RESULT,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetQueryResult');
            });
        });

        describe('handleGetHistoryForKey', () => {
            const key = 'theKey';

            let expectedMsg;
            before(() => {
                const serviceProto = Handler.__get__('_serviceProto');

                const payload = new serviceProto.GetHistoryForKey();
                payload.setKey(key);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.GET_HISTORY_FOR_KEY,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should resolve when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves('some response');

                const result = await handler.handleGetHistoryForKey(key, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetHistoryForKey');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();

                const result = handler.handleGetHistoryForKey(key, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('GetHistoryForKey');
            });
        });

        describe('handleInvokeChaincode', () => {
            const chaincodeName = 'myChaincode';
            const args = ['duck', 'duck', 'goose'];

            const serviceProto = Handler.__get__('_serviceProto');

            let expectedMsg;
            before(() => {
                const chaincodeProto = Handler.__get__('_chaincodeProto');

                const payload = new chaincodeProto.ChaincodeSpec();
                const chaincodeId = new chaincodeProto.ChaincodeID();
                const chaincodeInput = new chaincodeProto.ChaincodeInput();
                chaincodeId.setName(chaincodeName);
                const inputArgs = [];
                args.forEach((arg) => {
                    inputArgs.push(Buffer.from(arg, 'utf8'));
                });
                chaincodeInput.setArgs(inputArgs);
                payload.setChaincodeId(chaincodeId);
                payload.setInput(chaincodeInput);

                expectedMsg = {
                    type: serviceProto.ChaincodeMessage.Type.INVOKE_CHAINCODE,
                    payload: payload.toBuffer(),
                    channel_id: 'theChannelID',
                    txid: 'theTxID'
                };
            });

            afterEach(() => {
                Handler = rewire('../../../fabric-shim/lib/handler.js');
                sandbox.restore();
            });

            it ('should return decoded response when chaincode message type COMPLETED', async () => {
                const responseProto = Handler.__get__('_responseProto');
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves({type: serviceProto.ChaincodeMessage.Type.COMPLETED, payload: 'some payload'});
                const decodeStub = sandbox.stub(responseProto.Response, 'decode').returns('some response');

                const result = await handler.handleInvokeChaincode(chaincodeName, args, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal('some response');
                expect(decodeStub.firstCall.args.length).to.deep.equal(1);
                expect(decodeStub.firstCall.args[0]).to.deep.equal('some payload');
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('InvokeChaincode');
            });

            it ('should throw an error when _askPeerAndListen resolves with an error', async () => {
                const responseProto = Handler.__get__('_responseProto');
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves({type: serviceProto.ChaincodeMessage.Type.ERROR, payload: 'some payload'});
                const decodeStub = sandbox.stub(responseProto.Response, 'decode').returns('some response');

                const result = handler.handleInvokeChaincode(chaincodeName, args, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejectedWith('some payload');
                expect(decodeStub.called).to.deep.equal(false);
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('InvokeChaincode');
            });

            it ('should reject when _askPeerAndListen resolves', async () => {
                const responseProto = Handler.__get__('_responseProto');
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').rejects();
                const decodeStub = sandbox.stub(responseProto.Response, 'decode').returns('some response');

                const result = handler.handleInvokeChaincode(chaincodeName, args, 'theChannelID', 'theTxID');

                await expect(result).to.eventually.be.rejected;
                expect(decodeStub.called).to.deep.equal(false);
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('InvokeChaincode');
            });

            it ('should return nothing chaincode message type not COMPLETED or ERROR', async () => {
                const responseProto = Handler.__get__('_responseProto');
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
                const _askPeerAndListenStub = sandbox.stub(handler, '_askPeerAndListen').resolves({type: serviceProto.ChaincodeMessage.Type.SOMETHING_ELSE, payload: 'some payload'});
                const decodeStub = sandbox.stub(responseProto.Response, 'decode').returns('some response');

                const result = await handler.handleInvokeChaincode(chaincodeName, args, 'theChannelID', 'theTxID');

                expect(result).to.deep.equal(undefined);
                expect(decodeStub.called).to.deep.equal(false);
                expect(_askPeerAndListenStub.firstCall.args.length).to.deep.equal(2);
                expect(_askPeerAndListenStub.firstCall.args[0]).to.deep.equal(expectedMsg);
                expect(_askPeerAndListenStub.firstCall.args[1]).to.deep.equal('InvokeChaincode');
            });
        });

        describe('_askPeerAndListen', () => {
            it ('should return a new promise with value of queueMsg result', async () => {
                const msg = 'some message';
                const method = 'SomeMethod';

                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);

                handler.msgQueueHandler = sinon.createStubInstance(MsgQueueHandler);
                handler.msgQueueHandler.queueMsg.callsFake((qMsg) => {
                    qMsg.success('a payload');
                });

                const result = await handler._askPeerAndListen(msg, method);

                expect(result).to.deep.equal('a payload');
                expect(handler.msgQueueHandler.queueMsg.firstCall.args[0].constructor.name).to.deep.equal('QMsg');
                expect(handler.msgQueueHandler.queueMsg.firstCall.args[0].msg).to.deep.equal(msg);
                expect(handler.msgQueueHandler.queueMsg.firstCall.args[0].method).to.deep.equal(method);
            });
        });

        describe('toString', () => {
            it ('should return ChaincodeSupportClient object as a string with the URL', () => {
                const handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);

                expect(handler.toString()).to.deep.equal(`ChaincodeSupportClient : {url:${mockPeerAddress.unsecure}}`);
            });
        });
    });

    describe('handleMessage', () => {

        let handleMessage;
        let chaincodeProto;
        let serviceProto;

        let decodeStub;

        const msg = {
            channel_id: 'theChannelID',
            txid: 'aTX',
            payload: 'some payload',
            proposal: 'some proposal'
        };

        const mockHandler = {};
        mockHandler.chaincode = {};

        const mockStub = sinon.createStubInstance(Stub);
        mockStub.chaincodeEvent = 'some event';

        let saveCreateStub;

        before(() => {
            saveCreateStub = Handler.__get__('createStub');
        });

        beforeEach(() => {
            handleMessage = Handler.__get__('handleMessage');
            chaincodeProto = Handler.__get__('_chaincodeProto');
            serviceProto = Handler.__get__('_serviceProto');

            mockHandler._stream = {write: sinon.stub()};

            decodeStub = sandbox.stub(chaincodeProto.ChaincodeInput, 'decode').returns('some message');

            const createStubStub = sandbox.stub().returns(mockStub);
            Handler.__set__('createStub', createStubStub);
        });

        afterEach(() => {
            Handler.__set__('createStub', saveCreateStub);
            sandbox.restore();
        });

        describe('Error', () => {
            let expectedResponse;

            beforeEach(() => {
                expectedResponse = {
                    type: serviceProto.ChaincodeMessage.Type.ERROR,
                    payload: Buffer.from('shim message'),
                    channel_id: msg.channel_id,
                    txid: msg.txid
                };
            });

            it ('should handle an error decoding the payload', async () => {
                decodeStub.restore();
                decodeStub = sandbox.stub(chaincodeProto.ChaincodeInput, 'decode').throws('some error');

                expectedResponse.payload = msg.payload;

                await handleMessage(msg, mockHandler, 'init');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });

            it ('should handle error creating a chaincode stub', async () => {
                const createStubStub = sandbox.stub().throws('an error');
                Handler.__set__('createStub', createStubStub);

                expectedResponse.payload = Buffer.from('an error');

                await handleMessage(msg, mockHandler, 'init');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });

            it ('should handle chaincode.Init returning nothing', async () => {
                mockHandler.chaincode.Init = sandbox.stub().resolves();

                await handleMessage(msg, mockHandler, 'init');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Init.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Init.firstCall.args[0]).to.deep.equal(mockStub);

                const text = '[theChannelID-aTX] Calling chaincode Init() has not called success or error.';
                expectedResponse.payload = Buffer.from(text);
                expect(mockHandler._stream.write.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.firstCall.args[0].payload.toString()).to.equal(text);
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });

            it ('should handle chaincode.Invoke returning nothing', async () => {
                mockHandler.chaincode.Invoke = sandbox.stub().resolves();

                await handleMessage(msg, mockHandler, 'invoke');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Invoke.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Invoke.firstCall.args[0]).to.deep.equal(mockStub);
                const text = '[theChannelID-aTX] Calling chaincode Invoke() has not called success or error.';
                expectedResponse.payload = Buffer.from(text);
                expect(mockHandler._stream.write.calledOnce).to.be.ok;

                expect(mockHandler._stream.write.firstCall.args[0].payload.toString()).to.equal(text);
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });

            it ('should handle chaincode.Init returning no status', async () => {
                mockHandler.chaincode.Init = sandbox.stub().resolves({});

                await handleMessage(msg, mockHandler, 'init');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Init.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Init.firstCall.args[0]).to.deep.equal(mockStub);
                const text = '[theChannelID-aTX] Calling chaincode Init() has not called success or error.';
                expectedResponse.payload = Buffer.from(text);

                expect(mockHandler._stream.write.calledOnce).to.be.ok;

                expect(mockHandler._stream.write.firstCall.args[0].payload.toString()).to.equal(text);
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });

            it ('should handle chaincode.Invoke returning no status', async () => {
                mockHandler.chaincode.Invoke = sandbox.stub().resolves({});

                await handleMessage(msg, mockHandler, 'invoke');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Invoke.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Invoke.firstCall.args[0]).to.deep.equal(mockStub);
                const text = '[theChannelID-aTX] Calling chaincode Invoke() has not called success or error.';
                expectedResponse.payload = Buffer.from(text);

                expect(mockHandler._stream.write.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
                expect(mockHandler._stream.write.firstCall.args[0].payload.toString()).to.equal(text);
            });
        });

        describe('Complete', () => {
            let expectedResponse;

            beforeEach(() => {
                expectedResponse = {
                    type: serviceProto.ChaincodeMessage.Type.COMPLETED,
                    payload: 'a buffered payload',
                    channel_id: msg.channel_id,
                    txid: msg.txid,
                    chaincode_event: mockStub.chaincodeEvent
                };
            });

            it ('should write a COMPLETE message when successful init', async () => {
                mockHandler.chaincode.Init = sandbox.stub().resolves({status: Stub.RESPONSE_CODE.OK, toBuffer: () => {
                    return 'a buffered payload';
                }});

                await handleMessage(msg, mockHandler, 'init');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Init.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Init.firstCall.args[0]).to.deep.equal(mockStub);
                expect(mockHandler._stream.write.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });

            it ('should write a COMPLETE message when successful invoke', async () => {
                mockHandler.chaincode.Invoke = sandbox.stub().resolves({status: Stub.RESPONSE_CODE.OK, toBuffer: () => {
                    return 'a buffered payload';
                }});

                await handleMessage(msg, mockHandler, 'invoke');

                expect(decodeStub.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Invoke.calledOnce).to.be.ok;
                expect(mockHandler.chaincode.Invoke.firstCall.args[0]).to.deep.equal(mockStub);
                expect(mockHandler._stream.write.calledOnce).to.be.ok;
                expect(mockHandler._stream.write.firstCall.args[0]).to.deep.equal(expectedResponse);
            });
        });
    });

    describe('createStub', () => {
        it ('should return a new instance of Stub', () => {
            const saveStub = Handler.__get__('Stub');

            const mockStub = sinon.spy(() => {
                return sinon.createStubInstance(Stub);
            });
            Handler.__set__('Stub', mockStub);

            const createStub = Handler.__get__('createStub');
            createStub({}, 'channelID', 'txID', 'some input', 'some proposal');

            expect(mockStub.calledWithNew).to.be.ok;
            expect(mockStub.firstCall.args[0]).to.deep.equal({});
            expect(mockStub.firstCall.args[1]).to.deep.equal('channelID');
            expect(mockStub.firstCall.args[2]).to.deep.equal('txID');
            expect(mockStub.firstCall.args[3]).to.deep.equal('some input');
            expect(mockStub.firstCall.args[4]).to.deep.equal('some proposal');

            Handler.__set__('Stub', saveStub);
        });
    });

    describe('newErrorMsg', () => {
        it ('should return an object for the error message', () => {
            const newErrorMsg = Handler.__get__('newErrorMsg');

            const msg = {
                channel_id: 'theChannelID',
                txid: 'aTX',
                type: 'aType',
                payload: 'aPayload'
            };

            const state = 'aState';

            const result = newErrorMsg(msg, state);

            const expectedResponse = {
                type: 'ERROR',
                payload: Buffer.from(`[${msg.channel_id}-${msg.txid}] Chaincode handler FSM cannot handle message (${msg.type}) with payload size (8) while in state: ${state}`),
                channel_id: 'theChannelID',
                txid: 'aTX'
            };

            expect(result).to.deep.equal(expectedResponse);
        });
    });

    describe('handleGetStateMetadata', () => {
        let handleGetStateMetadata;
        let payload;
        let metaKey;
        let ep;

        before(() => {
            handleGetStateMetadata = Handler.__get__('handleGetStateMetadata');
            const serviceProto = Handler.__get__('_serviceProto');
            ep = Buffer.from('someEP');
            metaKey = 'theMetaKey';

            const stateMetadata = new serviceProto.StateMetadata();
            stateMetadata.setMetakey(metaKey);
            stateMetadata.setValue(ep);

            payload = new serviceProto.StateMetadataResult();
            const entries = [stateMetadata];
            payload.setEntries(entries);

            payload = payload.toBuffer();
        });

        it('should success', () => {
            const res = handleGetStateMetadata(payload);
            expect(res).to.haveOwnProperty(metaKey);
            expect(res[metaKey].toBuffer()).to.eql(ep);
        });
    });

    describe('parseResponse', () => {
        const qrDecodedPayload = 'qr decoded payload';
        const ccDecodedPayload = 'cc decoded payload';
        const mdDecodedPayload = 'metadata decoded payload';

        let MSG_TYPE;

        let serviceProto;
        let parseResponse;

        let handler;
        let res;

        let saveStateQueryIterator;
        let saveHistoryQueryIterator;

        before(() => {
            saveStateQueryIterator = Handler.__get__('StateQueryIterator');
            saveHistoryQueryIterator = Handler.__get__('HistoryQueryIterator');

            MSG_TYPE = Handler.__get__('MSG_TYPE');

            serviceProto = Handler.__get__('_serviceProto');
            serviceProto.QueryResponse = {
                decode: sinon.stub().returns(qrDecodedPayload)
            };
            serviceProto.ChaincodeMessage = {
                decode: sinon.stub().returns(ccDecodedPayload)
            };
            serviceProto.QueryResponseMetadata = {
                decode: sinon.stub().returns(mdDecodedPayload)
            };

            parseResponse = Handler.__get__('parseResponse');
        });

        beforeEach(() => {
            res = {
                type: MSG_TYPE.RESPONSE,
                payload: 'some payload',
                channel_id: 'theChannelID',
                txid: 'aTx'
            };

            handler = new Handler(mockChaincodeImpl, mockPeerAddress.unsecure);
        });

        after(() => {
            Handler.__set__('StateQueryIterator', saveStateQueryIterator);
            Handler.__set__('HistoryQueryIterator', saveHistoryQueryIterator);
        });

        it ('should throw an error when type not MSG_TYPE RESPONSE or ERROR', () => {
            res.type = 'some bad type';

            expect(() => {
                parseResponse(handler, res, 'some method');
            }).to.throw(/\[theChannelID-aTx\] Received incorrect chaincode in response to the some method\(\) call: type=\"some bad type\", expecting \"RESPONSE\"/);
        });

        it ('should throw an error when type MSG_TYPE ERROR', () => {
            res.type = MSG_TYPE.ERROR;

            const regEx = new RegExp(res.payload);

            expect(() => {
                parseResponse(handler, res, 'some method');
            }).to.throw(regEx);
        });

        it ('should return the payload when using an unknown method', () => {
            const result = parseResponse(handler, res, 'some method');

            expect(result).to.deep.equal(res.payload);
        });

        it ('should return the payload when using GetState for method', () => {
            const result = parseResponse(handler, res, 'GetState');

            expect(result).to.deep.equal(res.payload);
        });

        it ('should return the payload when using PutState for method', () => {
            const result = parseResponse(handler, res, 'PutState');

            expect(result).to.deep.equal(res.payload);
        });

        it ('should return QueryResponse.decoded payload for QueryStateClose', () => {
            const result = parseResponse(handler, res, 'QueryStateClose');

            expect(result).to.deep.equal(qrDecodedPayload);
        });

        it ('should return QueryResponse.decoded payload for QueryStateNext', () => {
            const result = parseResponse(handler, res, 'QueryStateNext');

            expect(result).to.deep.equal(qrDecodedPayload);
        });

        it ('should return ChaincodeMessage.decoded payload for InvokeChaincode', () => {
            const result = parseResponse(handler, res, 'InvokeChaincode');

            expect(result).to.deep.equal(ccDecodedPayload);
        });

        it ('should return a StateQueryIterator for GetStateByRange', () => {
            const mockStateQueryIterator = sinon.spy(() => {
                return sinon.createStubInstance(StateQueryIterator);
            });
            Handler.__set__('StateQueryIterator', mockStateQueryIterator);

            parseResponse(handler, res, 'GetStateByRange');

            expect(mockStateQueryIterator.calledWithNew).to.be.ok;
            expect(mockStateQueryIterator.firstCall.args).to.deep.equal([handler, res.channel_id, res.txid, qrDecodedPayload]);
        });


        it ('should decode metadata', () => {
            const mockStateQueryIterator = sinon.spy(() => {
                return sinon.createStubInstance(StateQueryIterator);
            });
            const pagedQrPayload = {
                results: 'some results',
                metadata: 'some metadata',
            };
            serviceProto.QueryResponse = {
                decode: sinon.stub().returns(pagedQrPayload)
            };
            Handler.__set__('StateQueryIterator', mockStateQueryIterator);

            const result = parseResponse(handler, res, 'GetStateByRange');

            expect(mockStateQueryIterator.calledWithNew).to.be.ok;
            expect(mockStateQueryIterator.firstCall.args).to.deep.equal([handler, res.channel_id, res.txid, pagedQrPayload]);

            expect(result.metadata).to.eql(mdDecodedPayload);
            serviceProto.QueryResponse = {
                decode: sinon.stub().returns(qrDecodedPayload)
            };
        });

        it ('should return a StateQueryIterator for GetQueryResult', () => {
            const mockStateQueryIterator = sinon.spy(() => {
                return sinon.createStubInstance(StateQueryIterator);
            });
            Handler.__set__('StateQueryIterator', mockStateQueryIterator);

            parseResponse(handler, res, 'GetQueryResult');

            expect(mockStateQueryIterator.calledWithNew).to.be.ok;
            expect(mockStateQueryIterator.firstCall.args).to.deep.equal([handler, res.channel_id, res.txid, qrDecodedPayload]);
        });

        it ('should return a HistoryQueryIterator for GetHistoryForKey', () => {
            const mockHistoryQueryIterator = sinon.spy(() => {
                return sinon.createStubInstance(HistoryQueryIterator);
            });
            Handler.__set__('HistoryQueryIterator', mockHistoryQueryIterator);

            parseResponse(handler, res, 'GetHistoryForKey');

            expect(mockHistoryQueryIterator.calledWithNew).to.be.ok;
            expect(mockHistoryQueryIterator.firstCall.args).to.deep.equal([handler, res.channel_id, res.txid, qrDecodedPayload]);
        });

        it('shold decode state metadata for GetStateMetadata', () => {
            const mockHandleGetStateMetadata = sinon.stub().returns('decoded response');
            Handler.__set__('handleGetStateMetadata', mockHandleGetStateMetadata);
            const result = parseResponse(handler, res, 'GetStateMetadata');

            expect(result).to.eql('decoded response');
            sinon.assert.calledOnce(mockHandleGetStateMetadata);
            sinon.assert.calledWith(mockHandleGetStateMetadata, res.payload);
        });
    });
});
