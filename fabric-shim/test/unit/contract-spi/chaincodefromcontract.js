/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* global describe it beforeEach afterEach */
'use strict';

// test specific libraries
const chai = require('chai');
chai.should();

chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const mockery = require('mockery');
const Logger = require('../../../lib/logger.js');


// standard utility fns
const path = require('path');

// class under test
const pathToRoot = '../../../..';

const Contract = require('fabric-contract-api').Contract;
const JSONSerializer = require(path.join(pathToRoot, 'fabric-contract-api/lib/jsontransactionserializer.js'));

const SystemContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/systemcontract'));
const StartCommand = require(path.join(pathToRoot, 'fabric-shim/lib/cmds/startCommand.js'));
const ChaincodeFromContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/chaincodefromcontract'));
const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));

const utils = require('../../../lib/utils/utils');

const defaultSerialization = {
    transaction: 'jsonSerializer',
    serializers: {
        jsonSerializer: JSONSerializer
    }
};
let alphaStub;
let betaStub;

let beforeFnStubA;
let afterFnStubA;
let unknownStub;
let privateStub;
let ctxStub;
let getSchemaMock;

function log(...e) {
    // eslint-disable-next-line
    console.log(...e);
}

const certWithoutAttrs = '-----BEGIN CERTIFICATE-----' +
    'MIICXTCCAgSgAwIBAgIUeLy6uQnq8wwyElU/jCKRYz3tJiQwCgYIKoZIzj0EAwIw' +
    'eTELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
    'biBGcmFuY2lzY28xGTAXBgNVBAoTEEludGVybmV0IFdpZGdldHMxDDAKBgNVBAsT' +
    'A1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwOTA4MDAxNTAwWhcNMTgw' +
    'OTA4MDAxNTAwWjBdMQswCQYDVQQGEwJVUzEXMBUGA1UECBMOTm9ydGggQ2Fyb2xp' +
    'bmExFDASBgNVBAoTC0h5cGVybGVkZ2VyMQ8wDQYDVQQLEwZGYWJyaWMxDjAMBgNV' +
    'BAMTBWFkbWluMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFq/90YMuH4tWugHa' +
    'oyZtt4Mbwgv6CkBSDfYulVO1CVInw1i/k16DocQ/KSDTeTfgJxrX1Ree1tjpaodG' +
    '1wWyM6OBhTCBgjAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIwADAdBgNVHQ4E' +
    'FgQUhKs/VJ9IWJd+wer6sgsgtZmxZNwwHwYDVR0jBBgwFoAUIUd4i/sLTwYWvpVr' +
    'TApzcT8zv/kwIgYDVR0RBBswGYIXQW5pbHMtTWFjQm9vay1Qcm8ubG9jYWwwCgYI' +
    'KoZIzj0EAwIDRwAwRAIgCoXaCdU8ZiRKkai0QiXJM/GL5fysLnmG2oZ6XOIdwtsC' +
    'IEmCsI8Mhrvx1doTbEOm7kmIrhQwUVDBNXCWX1t3kJVN' +
    '-----END CERTIFICATE-----';

describe('chaincodefromcontract', () => {

    class MockDataMarhsall {
        constructor() {

        }
    }

    class mockAjv {
        constructor() {

        }
    }

    /**
    * A fake  contract class;
    */
    class SCAlpha extends Contract {
        constructor() {
            super('alpha');
        }
        /**
        * @param {object} api api
        * @param {String} arg1 arg1
        * @param {String} arg2 arg2
        */
        async alpha(api, arg1, arg2) {
            return alphaStub(api, arg1, arg2);
        }
    }

    /**
    * A fake  contract class;
    */
    class SCBeta extends Contract {
        constructor() {
            super('beta');
            this.property = 'value';
        }
        /**
        * @param {object} api api
        */
        beta(api) {
            betaStub(api);
        }

        async afterTransaction(ctx) {
            return afterFnStubA(ctx);
        }

        async beforeTransaction(ctx) {
            return beforeFnStubA(ctx);
        }

        async unknownTransaction(ctx) {
            return unknownStub(ctx);
        }

        createContext() {
            return ctxStub;
        }

        _privateFunction() {
            privateStub();
        }

    }

    /**
    * A fake  contract class;
    */
    class SCDelta extends Contract {


        constructor() {
            super('delta');
        }

    }

    let sandbox;
    let isContractStub;

    beforeEach('Sandbox creation', () => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: false
        });
        sandbox = sinon.createSandbox();

        beforeFnStubA = sandbox.stub().named('beforeFnStubA');
        afterFnStubA = sandbox.stub().named('afterFnStubA');
        alphaStub = sandbox.stub().named('alphaStub');
        betaStub = sandbox.stub().named('betaStub');
        getSchemaMock = sandbox.stub();
        mockAjv.getSchema = getSchemaMock;
        isContractStub = sandbox.stub(Contract, '_isContract').returns(true);

        mockery.registerMock('./systemcontract', SystemContract);
        mockery.registerMock('ajv', mockAjv);

        const pathStub = sandbox.stub(path, 'resolve');
        pathStub.withArgs(sinon.match.any, '/some/path').returns('/some/path');
        pathStub.withArgs('/some/path', 'package.json').returns('packagejson');

        const mock = {
            version: '1.0.1',
            name: 'some package'
        };

        mockery.registerMock('packagejson', mock);
        // mockery.registerMock('./datamarshall.js', MockDataMarhsall);

        sandbox.stub(StartCommand, 'getArgs').returns({
            'module-path': '/some/path'
        });

    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
        mockery.disable();
    });

    describe('#constructor', () => {

        it('should handle no classes being passed in', () => {
            (() => {
                new ChaincodeFromContract();
            }).should.throw(/Missing argument/);
        });

        it('should handle missing serialization information', () => {
            const tempClass = class {
                constructor() { }
            };

            (() => {
                new ChaincodeFromContract([
                    tempClass
                ]);
            }).should.throw(/Missing argument/);
        });


        it('should handle a single class being passed as a contract', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);
        });

        it('should handle a case where the metadata is incompatible with code', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            _checkSuppliedStub.returns(['totally unaceptable']);
            (() => {
                new ChaincodeFromContract([SCAlpha], defaultSerialization);
            }).should.throw();


        });

    });

    describe('#_compileSchemas', () => {
        it('should handle no complex objects being available', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({
                components: {
                    schemas: {

                    }
                }
            });
            sandbox.stub(ChaincodeFromContract.prototype, '_dataMarshall').returns(MockDataMarhsall);

            new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);
        });

        it('should handle complex objects being available', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });

            const metadata = {
                components: {
                    schemas: {
                        Asset: {
                            $id: 'Asset',
                            properties: [
                                {
                                    name: 'thename',
                                    schema: {
                                        type: 'string'
                                    }
                                }
                            ]
                        }
                    }
                }
            };


            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns(metadata);
            sandbox.stub(ChaincodeFromContract.prototype, '_ajv').returns(mockAjv);
            sandbox.stub(ChaincodeFromContract.prototype, '_dataMarshall').returns(MockDataMarhsall);
            new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);
        });
    });

    describe('#_resolveContractImplementations', () => {

        it('should handle a single class being passed as a contract', () => {
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            mockery.registerMock('SCAlpha', SCAlpha);
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(_checkSuppliedStub);
            cc.defaultContractName.should.deep.equal('alpha');
        });
        it('should handle a single class being passed that is not valid', () => {
            isContractStub.returns(false);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            sandbox.stub(ChaincodeFromContract.prototype, '_dataMarshall').returns(MockDataMarhsall);
            mockery.registerMock('SCAlpha', function () { });
            (() => {
                new ChaincodeFromContract([String], defaultSerialization);
            }).should.throw(/invalid contract instance/);
        });
        it('should handle a two classes being passed as a contract', () => {
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            mockery.registerMock('SCAlpha', SCAlpha);
            const cc = new ChaincodeFromContract([SCBeta, SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(_checkSuppliedStub);
            cc.defaultContractName.should.deep.equal('beta');
        });

        it('should handle the default tag being used', () => {
            sandbox.stub(Reflect, 'getMetadata').withArgs('fabric:default', global).returns('alpha');
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            mockery.registerMock('SCAlpha', SCAlpha);
            const cc = new ChaincodeFromContract([SCBeta, SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(_checkSuppliedStub);
            cc.defaultContractName.should.deep.equal('alpha');
        });
    });


    describe('#init', () => {
        let fakeSuccess;
        let fakeError;

        beforeEach(() => {
            fakeSuccess = sinon.fake((e) => {
                log(e);
            });

            fakeError = sinon.fake((e) => {
                sinon.assert.fail(e);
            });

            sandbox.replace(shim, 'success', fakeSuccess);
            sandbox.replace(shim, 'error', fakeError);
        });
        it('should handle a single class being passed as a contract', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {getBufferArgs: sandbox.stub().returns([])};
            cc.invokeFunctionality = sandbox.stub();
            return cc.Init(mockStub);

        });
        it('should handle a single class being passed as a contract', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {getBufferArgs: sandbox.stub().returns([Buffer.from('Hello')])};
            cc.invokeFunctionality = sandbox.stub();
            return cc.Init(mockStub);

        });
    });

    describe('#invoke', () => {
        it('should handle a single class being passed as a contract', () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {
                getBufferArgs: sandbox.stub().returns([Buffer.from('arg1'), Buffer.from('args2')]),
                getTxID: sandbox.stub().returns(12345)
            };
            cc.invokeFunctionality = sandbox.stub();
            return cc.Invoke(mockStub);

        });

        it('should pass the logging object to contracts', async () => {
            const idBytes = {
                toBuffer: () => {
                    return new Buffer(certWithoutAttrs);
                }
            };
            const tempClass = class extends Contract {
                constructor() {
                    super('logging');
                }
                /**
                    * @param {object} api api
                    * @param {String} arg1 arg1
                    * @param {String} arg2 arg2
                    */
                async alpha(ctx, arg1, arg2) {
                    return alphaStub(ctx, arg1, arg2);
                }
            };
            const systemContract = new SystemContract();
            const appClass = new tempClass();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    },
                    'logging': {
                        contractInstance: appClass,
                        transactions: [
                            {
                                name: 'alpha'
                            }
                        ],
                        dataMarshall: {
                            handleParameters: sandbox.stub().returns([]),
                            toWireBuffer: sandbox.stub()
                        }
                    }
                });
            sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');

            const mockSigningId = {
                getMspid: sinon.stub(),
                getIdBytes: sinon.stub().returns(idBytes)
            };
            const cc = new ChaincodeFromContract([tempClass], defaultSerialization);
            const mockStub = {
                getBufferArgs: sandbox.stub().returns(['logging:alpha']),
                getTxID: sandbox.stub().returns('12345897asd7a7a77v7b77'),
                getChannelID: sandbox.stub().returns('channel-id-fake'),
                getCreator: sandbox.stub().returns(mockSigningId)
            };
            //
            const levelSpy = sinon.spy(Logger, 'setLevel');
            await cc.Invoke(mockStub);
            const ctx = alphaStub.getCall(0).args[0];
            ctx.logging.setLevel('DEBUG');
            sinon.assert.called(levelSpy);
            sinon.assert.calledWith(levelSpy, 'DEBUG');
            const cclogger = ctx.logging.getLogger();
            const logger = Logger.getLogger('logging');
            const infospy = sinon.spy(logger, 'info');
            cclogger.info('info');
            sinon.assert.calledWith(infospy, 'info');

            ctx.logging.setLevel('INFO');
            sinon.assert.called(levelSpy);
            sinon.assert.calledWith(levelSpy, 'INFO');


            const ccloggerNamed = ctx.logging.getLogger('wibble');
            const debugSpy = sinon.spy(Logger.getLogger('logging:wibble'), 'debug');
            ccloggerNamed.debug('Named logger');
            sinon.assert.calledWith(debugSpy, 'Named logger');


        });
    });

    describe('#_splitFunctionName', () => {
        it('should handle the usual case of ns:fn', () => {
            const result = ChaincodeFromContract.prototype._splitFunctionName('name:function');
            result.should.deep.equal({contractName: 'name', function: 'function'});
        });

        it('should handle the case of no contractName explicit', () => {
            const cc = ChaincodeFromContract.prototype;
            cc.defaultContractName = 'default';

            const result = cc._splitFunctionName(':function');
            result.should.deep.equal({contractName: 'default', function: 'function'});
        });

        it('should handle the case of no contractName implict', () => {
            const cc = ChaincodeFromContract.prototype;
            cc.defaultContractName = 'default';

            const result = cc._splitFunctionName('function');
            result.should.deep.equal({contractName: 'default', function: 'function'});
        });

        it('should handle the case of no input', () => {
            const cc = ChaincodeFromContract.prototype;
            cc.defaultContractName = 'default';

            const result = cc._splitFunctionName('');
            result.should.deep.equal({contractName: 'default', function: ''});
        });

        it('should handle the case of multiple :', () => {
            const result = ChaincodeFromContract.prototype._splitFunctionName('name:function:with:colons:');
            result.should.deep.equal({contractName: 'name', function: 'function:with:colons:'});
        });
    });

    describe('#invokeFunctionality', () => {
        let fakeSuccess;
        let fakeError;



        beforeEach(() => {
            fakeSuccess = sinon.fake((e) => {
                log(e);
            });

            fakeError = sinon.fake((e) => {
                log(e);
            });

            sandbox.replace(shim, 'success', fakeSuccess);
            sandbox.replace(shim, 'error', fakeError);
            sandbox.stub(utils, 'generateLoggingPrefix').returns('a logging prefix');
        });

        it('should handle missing function', async () => {
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {
                getBufferArgs: sandbox.stub().returns([]),
                getTxID: () => {
                    return 'a tx id';
                },
                getChannelID: () => {
                    return 'a channel id';
                }
            };
            await cc.invokeFunctionality(mockStub, 'name:missing', [Buffer.from('args2')]);

            sinon.assert.called(fakeError);
            sinon.assert.notCalled(fakeSuccess);

        });

        it('should handle valid contract name, but missing function', async () => {

            const idBytes = {
                toBuffer: () => {
                    return new Buffer(certWithoutAttrs);
                }
            };

            const ctx = {
                setChaincodeStub: sandbox.stub(),
                setClientIdentity: sandbox.stub()
            };

            const nameMetadata = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub()
                },
                dataMarshall: {},
                transactions: []
            };

            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({
                contracts: {
                    'name': nameMetadata
                }
            });
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);

            const mockSigningId = {
                getMspid: sinon.stub(),
                getIdBytes: sinon.stub().returns(idBytes)
            };

            const mockStub = {
                getBufferArgs: sandbox.stub().returns([]),
                getCreator: sandbox.stub().returns(mockSigningId),
                getTxID: () => {
                    return 'a tx id';
                },
                getChannelID: () => {
                    return 'a channel id';
                }
            };
            cc.contractImplementations.name = nameMetadata;

            await cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);
            sinon.assert.called(fakeSuccess);
            sinon.assert.notCalled(fakeError);

        });

        it('should handle valid contract name, but missing function and throws error', async () => {
            const idBytes = {
                toBuffer: () => {
                    return new Buffer(certWithoutAttrs);
                }
            };


            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);

            const mockSigningId = {
                getMspid: sinon.stub(),
                getIdBytes: sinon.stub().returns(idBytes)
            };

            const ctx = {
                setChaincodeStub: sandbox.stub(),
                setClientIdentity: sandbox.stub()
            };

            const mockStub = {
                getBufferArgs: sandbox.stub().returns([]),
                getCreator: sandbox.stub().returns(mockSigningId),
                getTxID: () => {
                    return 'a tx id';
                },
                getChannelID: () => {
                    return 'a channel id';
                }
            };
            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub().throws('error')
                },
                dataMarshall: {},
                transactions: []
            };

            cc.metadata = {
                contracts: {
                    name: cc.contractImplementations.name
                }
            };

            await cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);
            sinon.assert.called(fakeError);
            sinon.assert.notCalled(fakeSuccess);

        });

        it('should handle valid contract name, with valid function', async () => {

            const idBytes = {
                toBuffer: () => {
                    return new Buffer(certWithoutAttrs);
                }
            };


            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);

            const mockSigningId = {
                getMspid: sinon.stub(),
                getIdBytes: sinon.stub().returns(idBytes)
            };

            const ctx = {
                setChaincodeStub: sandbox.stub(),
                setClientIdentity: sandbox.stub()
            };

            const mockStub = {
                getBufferArgs: sandbox.stub().returns([]),
                getCreator: sandbox.stub().returns(mockSigningId),
                getTxID: () => {
                    return 'a tx id';
                },
                getChannelID: () => {
                    return 'a channel id';
                }
            };

            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub(),
                    beforeTransaction: sandbox.stub(),
                    afterTransaction: sandbox.stub(),
                    fn: sandbox.stub().resolves('hello world')
                },
                dataMarshall: {
                    handleParameters: sandbox.stub().returns(['args2']),
                    toWireBuffer: sandbox.stub()
                },
                transactions: [
                    {name: 'fn'}
                ]
            };

            cc.metadata.contracts = {
                name: {
                    transactions: cc.contractImplementations.name.transactions
                }
            };

            await cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);
            sinon.assert.calledWith(cc.contractImplementations.name.dataMarshall.handleParameters, {name: 'fn'}, [Buffer.from('args2')], 'a logging prefix');
            sinon.assert.calledWith(cc.contractImplementations.name.dataMarshall.toWireBuffer, 'hello world', undefined, 'a logging prefix');
            sinon.assert.called(fakeSuccess);
            sinon.assert.notCalled(fakeError);
        });

        it('should handle functions with returned values schema', async () => {

            const idBytes = {
                toBuffer: () => {
                    return new Buffer(certWithoutAttrs);
                }
            };
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);

            const mockSigningId = {
                getMspid: sinon.stub(),
                getIdBytes: sinon.stub().returns(idBytes)
            };

            const ctx = {
                setChaincodeStub: sandbox.stub(),
                setClientIdentity: sandbox.stub()
            };

            const mockStub = {
                getBufferArgs: sandbox.stub().returns([]),
                getCreator: sandbox.stub().returns(mockSigningId),
                getTxID: () => {
                    return 'a tx id';
                },
                getChannelID: () => {
                    return 'a channel id';
                }
            };
            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub(),
                    beforeTransaction: sandbox.stub(),
                    afterTransaction: sandbox.stub(),
                    fn: sandbox.stub().resolves('hello world')
                },
                dataMarshall: {
                    handleParameters: sandbox.stub().returns(['args2']),
                    toWireBuffer: sandbox.stub()
                },
                transactions: [
                    {
                        returns: {name: 'success', schema: {type: 'string'}},
                        name: 'fn',
                        tag: ['submitTx'],
                        parameters: []
                    },
                ]
            };

            cc.metadata.contracts = {
                name: {
                    transactions: cc.contractImplementations.name.transactions
                }
            };

            await cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);
            sinon.assert.calledWith(cc.contractImplementations.name.dataMarshall.handleParameters, cc.contractImplementations.name.transactions[0], [Buffer.from('args2')], 'a logging prefix');
            sinon.assert.calledWith(cc.contractImplementations.name.dataMarshall.toWireBuffer, 'hello world', {type: 'string'}, 'a logging prefix');
            sinon.assert.called(fakeSuccess);
            sinon.assert.notCalled(fakeError);

        });
    });

    describe('#_checkAgainstSuppliedMetadata', () => {
        const contractImpls = {
            'a.contract': {},
            'b.contract': {}
        };


        it('should return empty array when no issue', () => {
            const cc = ChaincodeFromContract.prototype;
            cc.contractImplementations = contractImpls;

            const metadata = {
                contracts: {
                    'a.contract': {},
                    'b.contract': {}
                }
            };

            cc._checkAgainstSuppliedMetadata(metadata).should.deep.equal([]);
        });

        it('should return empty array when metadata has no field contracts', () => {
            const cc = ChaincodeFromContract.prototype;
            cc.contractImplementations = contractImpls;

            const metadata = {};

            cc._checkAgainstSuppliedMetadata(metadata).should.deep.equal([]);
        });

        it('should return empty array when missing a contract', () => {
            const cc = ChaincodeFromContract.prototype;
            cc.contractImplementations = contractImpls;

            const metadata = {
                contracts: {
                    'a.contract': {}
                }
            };

            cc._checkAgainstSuppliedMetadata(metadata).should.deep.equal(['Missing contract b.contract in metadata']);
        });
    });

    describe('#_processContractInfo', () => {
        it('should be able to handle no annotations suppled', () => {
            mockery.registerMock('SCAlpha', SCDelta);
            SCDelta.prototype.foo = 'foo';
            sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            const data = cc._processContractInfo(cc.contractImplementations.alpha.contractInstance);

            sinon.assert.called(getMetadataStub);
            data.should.deep.equal({
                title: '',
                version: ''
            });
        });
        it('should be able to handle no annotations suppled', () => {
            mockery.registerMock('SCAlpha', SCDelta);
            SCDelta.prototype.foo = 'foo';
            sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata');
            getMetadataStub.returns({
                SCAlpha: {
                    title: 'contract info',
                    version: '3333'
                }
            });
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            const data = cc._processContractInfo(cc.contractImplementations.alpha.contractInstance);

            sinon.assert.called(getMetadataStub);
            data.should.deep.equal({
                title: 'contract info',
                version: '3333'
            });
        });
    });

    describe('#_processContractTransactions', () => {

        let cc;
        beforeEach(() => {
            mockery.registerMock('SCAlpha', SCDelta);
            SCDelta.prototype.foo = 'foo';
            sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata').returns([]);
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
        });

        it('should handle no transaction annotations used, ignoring functions that match in name to ignore array', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(null);

            const ci = cc.contractImplementations.alpha.contractInstance;
            Object.getPrototypeOf(ci).property = 'value';
            Object.getPrototypeOf(ci).ignoreMe = () => { };

            const transactions = ChaincodeFromContract.prototype._processContractTransactions(ci, ['ignoreMe']);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', ci);
            transactions.should.deep.equal([{
                name: 'alpha',
                parameters: [
                    {
                        description: 'Argument 0',
                        name: 'arg0',
                        schema: {
                            type: 'string'
                        }
                    },
                    {
                        description: 'Argument 1',
                        name: 'arg1',
                        schema: {
                            type: 'string'
                        }
                    }
                ],
                tags: ['submitTx']
            }]);

            delete Object.getPrototypeOf(ci).property;
            delete Object.getPrototypeOf(ci).ignoreMe;
        });

        it('should handle no transaction annotations used, ignoring functions that start with _', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(null);

            const ci = cc.contractImplementations.alpha.contractInstance;
            Object.getPrototypeOf(ci).property = 'value';
            Object.getPrototypeOf(ci)._ignoreMe = () => { };

            const transactions = ChaincodeFromContract.prototype._processContractTransactions(ci, []);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', ci);
            transactions.should.deep.equal([{
                name: 'alpha',
                parameters: [
                    {
                        description: 'Argument 0',
                        name: 'arg0',
                        schema: {
                            type: 'string'
                        }
                    },
                    {
                        description: 'Argument 1',
                        name: 'arg1',
                        schema: {
                            type: 'string'
                        }
                    }
                ],
                tags: ['submitTx']
            }]);

            delete Object.getPrototypeOf(ci).property;
            delete Object.getPrototypeOf(ci).ignoreMe;
        });

        it('should not add submitTx to the system contract functions', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(null);

            const ci = cc.contractImplementations.alpha.contractInstance;
            ci.getName = () => {
                return 'org.hyperledger.fabric';
            };

            const transactions = ChaincodeFromContract.prototype._processContractTransactions(ci, []);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', ci);
            transactions.should.deep.equal([{
                name: 'alpha',
                'parameters': [
                    {
                        'description': 'Argument 0',
                        'name': 'arg0',
                        'schema': {
                            'type': 'string'
                        }
                    },
                    {
                        'description': 'Argument 1',
                        'name': 'arg1',
                        'schema': {
                            'type': 'string'
                        }
                    }
                ]

            }]);
        });

        it('should handle transaction annotations being used', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns([{some: 'transaction'}]);

            const ci = cc.contractImplementations.alpha.contractInstance;

            const transactions = ChaincodeFromContract.prototype._processContractTransactions(cc.contractImplementations.alpha.contractInstance);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', ci);
            transactions.should.deep.equal([{
                some: 'transaction'
            }]);
        });

        it('should handle transactions with no arguments', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(null);

            const ci = cc.contractImplementations.alpha.contractInstance;
            Object.getPrototypeOf(ci).conga = (api) => { };

            const transactions = ChaincodeFromContract.prototype._processContractTransactions(ci, []);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', ci);
            transactions.should.deep.equal([
                {
                    name: 'alpha',
                    parameters: [
                        {
                            description: 'Argument 0',
                            name: 'arg0',
                            schema: {
                                type: 'string'
                            }
                        },
                        {
                            description: 'Argument 1',
                            name: 'arg1',
                            schema: {
                                type: 'string'
                            }
                        }
                    ],
                    tags: ['submitTx']
                },
                {
                    name: 'conga',
                    tags: ['submitTx']
                }
            ]);

            delete Object.getPrototypeOf(ci).conga;
        });

    });

    describe('#_augmentMetadataFromCode', () => {
        const exampleMetadata = {
            $schema: 'my schema link',
            contracts: {
                contractImplementations: {
                    name: 'someContract'
                }
            },
            info: {
                version: '0.1.1',
                title: 'some title'
            },
            components: {
                schemas: {
                    Greeting: {
                        $id: 'Greeting',
                        properties: [
                            {
                                name: 'text',
                                schema: {
                                    type: 'string'
                                }
                            }
                        ]
                    }
                }
            }
        };

        it('should not add extra detail for metadata, info and components when metadata supplied with those fields', () => {
            ChaincodeFromContract.prototype._augmentMetadataFromCode(exampleMetadata).should.deep.equal(exampleMetadata);
        });

        it('should use passed info', () => {
            const fakeCcfc = {
                contractImplementations: {
                    myContract: {
                        contractInstance: {
                            name: 'some name'
                        }
                    }
                },
                _augmentMetadataFromCode: ChaincodeFromContract.prototype._augmentMetadataFromCode,
                _processContractTransactions: sinon.stub().returns('some transactions'),
                _processContractInfo: sinon.stub().returns('some info')
            };
            const partialMetadata = {
                info: {
                    version: '0.1.1',
                    title: 'some title'
                }
            };
            const metadata = fakeCcfc._augmentMetadataFromCode(partialMetadata);

            const correctData = {
                '$schema': 'https://fabric-shim.github.io/release-1.4/contract-schema.json',
                'components': {
                    'schemas': {}
                },
                'contracts': {
                    'myContract': {
                        'contractInstance': {
                            'name': 'some name'
                        },
                        'info': 'some info',
                        'transactions': 'some transactions'
                    }
                },
                'info': {
                    'title': 'some title',
                    'version': '0.1.1'
                }
            };

            metadata.should.deep.equal(correctData);
            sinon.assert.calledOnce(fakeCcfc._processContractTransactions);
            sinon.assert.calledOnce(fakeCcfc._processContractInfo);
        });

        it('should handle contracts and remove underscore lead properties of contractInstance', () => {
            const metadataToSend = {
                info: exampleMetadata.info,
                components: exampleMetadata.components
            };

            const fakeCcfc = {
                contractImplementations: {
                    myContract: {
                        contractInstance: {
                            name: 'some name',
                            _someProperty: 'should ignore'
                        }
                    }
                },
                _augmentMetadataFromCode: ChaincodeFromContract.prototype._augmentMetadataFromCode,
                _processContractTransactions: sinon.stub().returns('some transactions'),
                _processContractInfo: sinon.stub().returns('some info')
            };

            const metadata = fakeCcfc._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal({
                myContract: {
                    contractInstance: {
                        name: 'some name'
                    },
                    info: 'some info',
                    transactions: 'some transactions'
                }
            });
            fakeCcfc.contractImplementations.myContract.contractInstance._someProperty.should.deep.equal('should ignore');
            metadata.info.should.deep.equal(metadataToSend.info);
            metadata.components.should.deep.equal(metadataToSend.components);
            sinon.assert.calledOnce(fakeCcfc._processContractTransactions);
            sinon.assert.calledOnce(fakeCcfc._processContractInfo);
        });
        it('should correctly retrieve info with the constructor title and version data', () => {
            const metadataToSend = {
                contracts: exampleMetadata.contracts,
                components: exampleMetadata.components,
            };
            ChaincodeFromContract.prototype.title = 'some title';
            ChaincodeFromContract.prototype.version = '0.1.1';
            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal({
                version: '0.1.1',
                title: 'some title'
            });
            metadata.components.should.deep.equal(metadataToSend.components);
        });

        it('should fill in info when there is no constructor title and version data', () => {
            const metadataToSend = {
                contracts: exampleMetadata.contracts,
                components: exampleMetadata.components,
            };
            ChaincodeFromContract.prototype.title = undefined;
            ChaincodeFromContract.prototype.version = undefined;
            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal({
                version: '',
                title: ''
            });
            metadata.components.should.deep.equal(metadataToSend.components);
        });

        it('should fill in components field when not set', () => {
            const metadataToSend = {
                contracts: exampleMetadata.contracts,
                info: exampleMetadata.info
            };

            const reflectStub = sandbox.stub(Reflect, 'getMetadata').returns({someSchema: {}});

            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal(metadataToSend.info);
            metadata.components.should.deep.equal({schemas: {someSchema: {}}});
            sinon.assert.calledOnce(reflectStub);
            sinon.assert.calledWith(reflectStub, 'fabric:objects', global);
        });

        it('should fill in components field when not set and reflect fails', () => {
            const metadataToSend = {
                contracts: exampleMetadata.contracts,
                info: exampleMetadata.info
            };

            const reflectStub = sandbox.stub(Reflect, 'getMetadata').returns(null);

            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal(metadataToSend.info);
            metadata.components.should.deep.equal({schemas: {}});
            sinon.assert.calledOnce(reflectStub);
            sinon.assert.calledWith(reflectStub, 'fabric:objects', global);
        });

        it('should fill in schema when not set', () => {
            const metadataToSend = {
                components: exampleMetadata.components,
                contracts: exampleMetadata.contracts,
                info: exampleMetadata.info
            };

            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.components.should.deep.equal(metadataToSend.components);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal(metadataToSend.info);
            metadata.$schema.should.deep.equal('https://fabric-shim.github.io/release-1.4/contract-schema.json');
        });
    });

    describe('#helper constructors', () => {
        it('should create the DataMarshall', () => {
            it('should handle a single class being passed as a contract', () => {
                const systemContract = new SystemContract();
                sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                    .returns({
                        'org.hyperledger.fabric': {
                            contractInstance: systemContract
                        }
                    });

                sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
                const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
                cc._dataMarshall('');
            });


        });
    });

});
