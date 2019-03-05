/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it beforeEach afterEach before after */
'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');
const ProtoLoader = require('../../lib/protoloader');
const path = require('path');

const Logger = require('../../lib/logger');

const chaincodePath = '../../lib/chaincode.js';
const StartCommand = require('../../lib/cmds/startCommand.js');

const _serviceProto = ProtoLoader.load({
    root: path.join(__dirname, '../../lib/protos'),
    file: 'peer/chaincode_shim.proto'
}).protos;

describe('Chaincode', () => {
    let Chaincode;
    describe('Chaincode \'spi\' interface', () => {
        it ('should be able to call the init method', () => {
            Chaincode = new (require(chaincodePath).ChaincodeInterface)();
            Chaincode.Init();
        });

        it ('should be able to call the init method', () => {
            Chaincode = new (require(chaincodePath).ChaincodeInterface)();
            Chaincode.Invoke();
        });
        it ('should only have the Init and Invoke', () => {
            Chaincode = new (require(chaincodePath).ChaincodeInterface)();
            const propNames = Object.getOwnPropertyNames(Object.getPrototypeOf(Chaincode));

            expect(propNames.length).to.eql(3);
            expect(propNames).to.have.members(['constructor', 'Init', 'Invoke']);
        });
    });

    describe('Start()', () => {

        beforeEach(() => {
            Chaincode = rewire(chaincodePath);
            Chaincode.__set__('yargs', {'argv': {'$0': 'fabric-chaincode-node'}});
        });

        it ('should throw an error if no arguments passed', () => {
            expect(() => {
                Chaincode.start();
            }).to.throw(/Missing required argument: chaincode/);
        });

        it ('should throw an error if string argument passed', () => {
            expect(() => {
                Chaincode.start('fakeChaincodeClass');
            }).to.throw(/Missing required argument: chaincode/);
        });

        it ('should throw an error if null argument passed', () => {
            expect(() => {
                Chaincode.start(null);
            }).to.throw(/Missing required argument: chaincode/);
        });

        it ('should throw an error if object missing init passed as argument', () => {
            expect(() => {
                Chaincode.start({});
            }).to.throw(/The "chaincode" argument must implement the "Init\(\)" method/);
        });

        it ('should throw an error if object missing invoke passed as argument', () => {
            expect(() => {
                Chaincode.start({
                    Init: () => {}
                });
            }).to.throw(/The "chaincode" argument must implement the "Invoke\(\)" method/);
        });

        it ('should start when passed init and invoke', () => {
            const handlerClass = Chaincode.__get__('Handler');
            const chat = sinon.stub(handlerClass.prototype, 'chat');

            const myYargs = {'argv': {'$0': 'fabric-chaincode-node', 'peer.address': 'localhost:7051', 'chaincode-id-name': 'mycc'}};
            Chaincode.__set__('yargs', myYargs);

            const getArgsStub = sinon.stub(StartCommand, 'getArgs').returns({
                'peer.address': 'localhost:7051',
                'chaincode-id-name': 'mycc'
            });

            Chaincode.start({Init: function() {}, Invoke: function() {}});

            sinon.assert.calledOnce(getArgsStub);
            sinon.assert.calledWith(getArgsStub, myYargs);

            expect(chat.calledOnce).to.be.ok;

            const args = chat.firstCall.args;
            expect(args.length).to.deep.equal(1);
            expect(typeof args[0]).to.deep.equal('object');
            expect(args[0].type).to.deep.equal(_serviceProto.ChaincodeMessage.Type.REGISTER);

            chat.restore();
            getArgsStub.restore();
        });

        it ('should delete unnecessary arguments passed to the CLI before passing on', () => {
            let testOpts = null;

            class MockHandler {
                constructor(chaincode, url, opts) {
                    testOpts = opts;
                }

                chat() {
                    // do nothing
                }
            }

            const myYargs = {'argv': {'$0': 'fabric-chaincode-node', 'peer.address': 'localhost:7051', 'chaincode-id-name': 'mycc', 'some-other-arg': 'another-arg', 'yet-another-bad-arg': 'arg'}};
            Chaincode.__set__('yargs', myYargs);

            const handlerClass = Chaincode.__get__('Handler');
            Chaincode.__set__('Handler', MockHandler);

            const getArgsStub = sinon.stub(StartCommand, 'getArgs').returns({
                'peer.address': 'localhost:7051',
                'chaincode-id-name': 'mycc',
                'some-other-arg': 'some other val',
                'yet-another-arg': 'yet another val',
                'module-path': 'some/path'
            });

            Chaincode.start({Init: function() {}, Invoke: function() {}});

            sinon.assert.calledOnce(getArgsStub);
            sinon.assert.calledWith(getArgsStub, myYargs);

            expect(testOpts.hasOwnProperty('some-other-arg')).to.be.false;
            expect(testOpts.hasOwnProperty('yet-another-arg')).to.be.false;
            expect(testOpts.hasOwnProperty('chaincode-id-name')).to.be.false;
            expect(testOpts.hasOwnProperty('module-path')).to.be.false;
            expect(testOpts.hasOwnProperty('peer.address')).to.be.true;

            Chaincode.__set__('Handler', handlerClass);

            getArgsStub.restore();
        });

        describe ('TLS handling', () => {
            const testfile = path.join(__dirname, '../../../package.json');

            const myYargs = {'argv': {'$0': 'fabric-chaincode-node', 'peer.address': 'localhost:7051', 'chaincode-id-name': 'mycc'}};

            let getArgsStub;

            before(() => {
                process.env.CORE_PEER_TLS_ENABLED = true;
                process.env.CORE_PEER_TLS_ROOTCERT_FILE = testfile;
            });

            beforeEach(() => {
                Chaincode = rewire(chaincodePath);
                Chaincode.__set__('yargs', myYargs);
                getArgsStub = sinon.stub(StartCommand, 'getArgs').returns({
                    'peer.address': 'localhost:7051',
                    'chaincode-id-name': 'mycc'
                });
            });

            afterEach(() => {
                delete process.env.CORE_TLS_CLIENT_KEY_PATH;
                delete process.env.CORE_TLS_CLIENT_CERT_PATH;

                getArgsStub.restore();
            });

            after(() => {
                delete process.env.CORE_PEER_TLS_ENABLED;
                delete process.env.CORE_PEER_TLS_ROOTCERT_FILE;
            });

            it ('should throw an error when CORE_TLS_CLIENT_KEY_PATH env var not set', () => {
                expect(() => {
                    Chaincode.start({Init: function() {}, Invoke: function() {}});
                }).to.throw(/The client key and cert are needed when TLS is enabled, but environment variables specifying the paths to these files are missing/);
            });

            it ('should throw an error when CORE_TLS_CLIENT_KEY_PATH env var set but CORE_TLS_CLIENT_CERT_PATH env var not set', () => {
                process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;
                expect(() => {
                    Chaincode.start({Init: function() {}, Invoke: function() {}});
                }).to.throw(/The client key and cert are needed when TLS is enabled, but environment variables specifying the paths to these files are missing/);
            });

            it ('should call handler.chat() with the correct object and output a message', () => {

                const handlerClass = Chaincode.__get__('Handler');
                const chat = sinon.stub(handlerClass.prototype, 'chat');

                process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;
                process.env.CORE_TLS_CLIENT_CERT_PATH = testfile;

                Chaincode.start({Init: function() {}, Invoke: function() {}});

                sinon.assert.calledOnce(getArgsStub);
                sinon.assert.calledWith(getArgsStub, myYargs);

                expect(chat.calledOnce).to.be.ok;

                const args = chat.firstCall.args;
                expect(args.length).to.deep.equal(1);
                expect(typeof args[0]).to.deep.equal('object');
                expect(args[0].type).to.deep.equal(_serviceProto.ChaincodeMessage.Type.REGISTER);

                chat.restore();
            });

            it ('should load the opts certificate attributes as JSON strings with the correct properties', () => {
                let testOpts = null;

                class MockHandler {
                    constructor(chaincode, url, opts) {
                        testOpts = opts;
                    }

                    chat() {
                        // do nothing
                    }
                }

                const handlerClass = Chaincode.__get__('Handler');
                Chaincode.__set__('Handler', MockHandler);

                process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;
                process.env.CORE_TLS_CLIENT_CERT_PATH = testfile;

                Chaincode.start({Init: function() {}, Invoke: function() {}});

                sinon.assert.calledOnce(getArgsStub);
                sinon.assert.calledWith(getArgsStub, myYargs);

                const attributes = ['pem', 'cert', 'key'];

                attributes.forEach((attr) => {
                    expect(typeof testOpts[attr]).to.deep.equal('string');

                    const json = JSON.parse(testOpts[attr]);
                    expect(json.name).to.deep.equal('fabric-shim-test');
                });

                Chaincode.__set__('Handler', handlerClass);
            });
        });
    });

    describe('parsePeerUrlFcn', () => {
        let parsePeerUrlFcn;

        beforeEach(() => {
            Chaincode = rewire(chaincodePath);
            parsePeerUrlFcn = Chaincode.__get__('parsePeerUrl');
        });

        it ('should throw an error if peer.address not set', () => {
            expect(() => {
                parsePeerUrlFcn();
            }).to.throw(/The "peer\.address" program argument must be set to a legitimate value of/);
        });

        it ('should throw an error if peer.address set to url', () => {
            expect(() => {
                parsePeerUrlFcn('http://dummyUrl');
            }).to.throw(/The "peer\.address" program argument can not be set to an "http\(s\)" url/);
        });

        it ('should use grpc when URL already has that prefix', () => {
            expect(parsePeerUrlFcn('grpc://localhost:7051')).to.deep.equal('grpc://localhost:7051');
        });

        it ('should use grpcs when URL already has that prefix', () => {
            expect(parsePeerUrlFcn('grpcs://localhost:7051')).to.deep.equal('grpcs://localhost:7051');
        });

        it ('should use grpc when CORE_PEER_TLS_ENABLED env var is not set', () => {
            process.env.CORE_PEER_TLS_ENABLED = undefined;
            expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpc://localhost:7051');
        });

        it ('should use grpc when CORE_PEER_TLS_ENABLED env var is set to false', () => {
            process.env.CORE_PEER_TLS_ENABLED = false;
            expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpc://localhost:7051');
        });

        it ('should use grpc when CORE_PEER_TLS_ENABLED env var is set to a string FALSE', () => {
            process.env.CORE_PEER_TLS_ENABLED = 'FALSE';
            expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpc://localhost:7051');
        });

        it ('should use grpcs when CORE_PEER_TLS_ENABLED env var is set to true', () => {
            process.env.CORE_PEER_TLS_ENABLED = true;
            expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpcs://localhost:7051');
        });

        it ('should use grpcs when CORE_PEER_TLS_ENABLED env var is set to a string TRUE', () => {
            process.env.CORE_PEER_TLS_ENABLED = 'TRUE';
            expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpcs://localhost:7051');
        });
    });

    describe('response', () => {
        let respProto;
        let ChaincodeStub;
        let mockResponse;
        let saveClass;

        beforeEach(() => {
            Chaincode = rewire(chaincodePath);

            respProto = Chaincode.__get__('_responseProto');
            ChaincodeStub = Chaincode.__get__('ChaincodeStub');
            mockResponse = sinon.createStubInstance(respProto.Response);
            saveClass = respProto.Response;

            class MockResponse {
                constructor() {
                    return mockResponse;
                }
            }

            respProto.Response = MockResponse;
        });

        after(() => {
            respProto.Response = saveClass;
        });

        it ('should let the code response an error', () => {
            const result = Chaincode.error('error msg');

            expect(result.message).to.deep.equal('error msg');
            expect(result.status).to.deep.equal(ChaincodeStub.RESPONSE_CODE.ERROR);
        });

        it ('should handle an empty success', () => {
            const result = Chaincode.success();

            expect(result.payload).to.deep.equal(Buffer.from(''));
            expect(result.status).to.deep.equal(ChaincodeStub.RESPONSE_CODE.OK);
        });

        it ('should handle a success with message', () => {
            const result = Chaincode.success('msg');

            expect(result.payload).to.deep.equal('msg');
            expect(result.status).to.deep.equal(ChaincodeStub.RESPONSE_CODE.OK);
        });
    });

    describe('newLogger()', () => {
        before(() => {
            Chaincode = rewire(chaincodePath);
        });

        it ('should use shim when calling getLogger and no name passed', () => {
            const loggerStub = sinon.stub(Logger, 'getLogger');

            Chaincode.newLogger();

            expect(loggerStub.calledOnce).to.be.ok;
            expect(loggerStub.getCall(0).args[0]).to.deep.equal('shim');

            Logger.getLogger.restore();
        });

        it ('should use shim when calling getLogger and name passed', () => {
            const loggerStub = sinon.stub(Logger, 'getLogger');

            Chaincode.newLogger('testLogger');

            expect(loggerStub.calledOnce).to.be.ok;
            expect(loggerStub.getCall(0).args[0]).to.deep.equal('testLogger');

            Logger.getLogger.restore();
        });
    });
});
