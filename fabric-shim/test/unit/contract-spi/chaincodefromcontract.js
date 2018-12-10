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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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
            _checkSuppliedStub.returns({errors: 'totally unaceptable'});
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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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


            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            mockery.registerMock('SCAlpha', SCAlpha);
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(_checkSuppliedStub);
            cc.defaultContractName.should.deep.equal('alpha');
        });
        it('should handle a single class being passed that is not valid', () => {

            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            sandbox.stub(ChaincodeFromContract.prototype, '_dataMarshall').returns(MockDataMarhsall);
            mockery.registerMock('SCAlpha', function () { });
            (() => {
                new ChaincodeFromContract([String], defaultSerialization);
            }).should.throw(/invalid contract instance/);

        });
        it('should handle a two classes being passed as a contract', () => {
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            mockery.registerMock('SCAlpha', SCAlpha);
            const cc = new ChaincodeFromContract([SCBeta, SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(_checkSuppliedStub);
            cc.defaultContractName.should.deep.equal('beta');
        });
    });


    describe('#init', () => {
        let fakeSuccess;
        let fakeError;

        beforeEach(() => {
            fakeSuccess = sinon.fake((e) => {
                sinon.assert.fail(e);
            });

            fakeError = sinon.fake((e) => {
                log(e);
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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {getBufferArgs: sandbox.stub().returns([])};
            cc.invokeFunctionality = sandbox.stub();
            cc.Init(mockStub);

        });
        it('should handle a single class being passed as a contract', () => {
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
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {getBufferArgs: sandbox.stub().returns([Buffer.from('Hello')])};
            cc.invokeFunctionality = sandbox.stub();
            cc.Init(mockStub);

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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {getBufferArgs: sandbox.stub().returns([Buffer.from('arg1'), Buffer.from('args2')])};
            cc.invokeFunctionality = sandbox.stub();
            cc.Invoke(mockStub);

        });
    });

    describe('#_splitFunctionName', () => {
        let cc;
        beforeEach(() => {
            // actual contract instance is not important for this test
            const systemContract = new SystemContract();
            sandbox.stub(ChaincodeFromContract.prototype, '_resolveContractImplementations')
                .returns({
                    'org.hyperledger.fabric': {
                        contractInstance: systemContract
                    }
                });
            sandbox.stub(ChaincodeFromContract.prototype, '_dataMarshall').returns(MockDataMarhsall);
            cc = new ChaincodeFromContract([SCBeta], defaultSerialization);
            cc.defaultContractName = 'default';
        });

        it('should handle the usual case of ns:fn', () => {
            const result = cc._splitFunctionName('name:function');
            result.should.deep.equal({contractName: 'name', function: 'function'});
        });

        it('should handle the case of no contractName explicit', () => {

            const result = cc._splitFunctionName(':function');
            result.should.deep.equal({contractName: 'default', function: 'function'});
        });

        it('should handle the case of no contractName implict', () => {
            const result = cc._splitFunctionName('function');
            result.should.deep.equal({contractName: 'default', function: 'function'});
        });

        it('should handle the case of no input', () => {
            const result = cc._splitFunctionName('');
            result.should.deep.equal({contractName: 'default', function: ''});
        });

        it('should handle the case of multiple :', () => {
            const result = cc._splitFunctionName('name:function:with:colons:');
            result.should.deep.equal({contractName: 'name', function: 'function:with:colons:'});
        });
    });

    describe('#invokeFunctionality', () => {
        let fakeSuccess;
        let fakeError;

        beforeEach(() => {
            fakeSuccess = sinon.fake((e) => {
                sinon.assert.fail(e);
            });

            fakeError = sinon.fake((e) => {
                log(e);
            });

            sandbox.replace(shim, 'success', fakeSuccess);
            sandbox.replace(shim, 'error', fakeError);
        });

        it('should handle missing function', () => {
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
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            sinon.assert.calledOnce(ChaincodeFromContract.prototype._resolveContractImplementations);
            sinon.assert.calledOnce(_checkSuppliedStub);


            const mockStub = {getBufferArgs: sandbox.stub().returns([])};
            cc.invokeFunctionality(mockStub, 'name:missing', [Buffer.from('args2')]);

            sinon.assert.called(fakeError);

        });

        it('should handle valid contract name, but missing function', () => {

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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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
                getCreator: sandbox.stub().returns(mockSigningId)
            };
            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub()
                },
                dataMarhsall: {},
                transactions: []

            };
            cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);

        });
        it('should handle valid contract name, with valid function', () => {

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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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
                getCreator: sandbox.stub().returns(mockSigningId)
            };
            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub(),
                    beforeTransaction: sandbox.stub(),
                    afterTransaction: sandbox.stub(),
                    fn: sandbox.stub().resolves()
                },
                dataMarshall: {
                    handleParameters: sandbox.stub().returns(['args2']),
                    toWireBuffer: sandbox.stub()
                },
                transactions: [
                    {name: 'fn'}
                ]

            };
            cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);

        });

        it('should handle functions with returned values', () => {

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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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
                getCreator: sandbox.stub().returns(mockSigningId)
            };
            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub(),
                    beforeTransaction: sandbox.stub(),
                    afterTransaction: sandbox.stub(),
                    fn: sandbox.stub().resolves()
                },
                dataMarshall: {
                    handleParameters: sandbox.stub().returns(['args2']),
                    toWireBuffer: sandbox.stub()
                },
                transactions: [

                    {
                        returns: [{name: 'success', schema: {type: 'string'}}],
                        name: 'fn',
                        tag: ['submitTx'],
                        parameters: []
                    },


                ]

            };
            cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);

        });

        it('should handle functions with returned values', () => {

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
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
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
                getCreator: sandbox.stub().returns(mockSigningId)
            };
            cc.contractImplementations.name = {
                contractInstance: {
                    createContext: sandbox.stub().returns(ctx),
                    unknownTransaction: sandbox.stub(),
                    beforeTransaction: sandbox.stub(),
                    afterTransaction: sandbox.stub(),
                    fn: sandbox.stub().resolves()
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
            cc.invokeFunctionality(mockStub, 'name:fn', [Buffer.from('args2')]);

        });

    });

    describe('#_processContractInfo', () => {
        it ('should be able to handle no annotations suppled', () => {
            mockery.registerMock('SCAlpha', SCDelta);
            SCDelta.prototype.foo = 'foo';
            sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata');
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            const data = cc._processContractInfo(cc.contractImplementations.alpha.contractInstance);

            sinon.assert.called(getMetadataStub);
            data.should.deep.equal({
                title:'',
                version:''
            });
        });
        it ('should be able to handle no annotations suppled', () => {
            mockery.registerMock('SCAlpha', SCDelta);
            SCDelta.prototype.foo = 'foo';
            sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata');
            getMetadataStub.returns({SCAlpha:{
                title:'contract info',
                version:'3333'
            }});
            const cc = new ChaincodeFromContract([SCAlpha], defaultSerialization);
            const data = cc._processContractInfo(cc.contractImplementations.alpha.contractInstance);

            sinon.assert.called(getMetadataStub);
            data.should.deep.equal({
                title:'contract info',
                version:'3333'
            });
        });
    });

    describe('#_processContractTransactions', () => {


        it('should handle a single class being passed as a contract that has no functions', () => {
            mockery.registerMock('SCDelta', SCDelta);
            SCDelta.prototype.foo = 'foo';
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');
            new ChaincodeFromContract([SCDelta], defaultSerialization);

            sinon.assert.calledOnce(_checkSuppliedStub);
        });

        it('should handle a single class being passed as a contract that has no functions', () => {
            mockery.registerMock('SCDelta', SCDelta);
            SCDelta.prototype.foo = 'foo';
            const _checkSuppliedStub = sandbox.stub(ChaincodeFromContract.prototype, '_checkAgainstSuppliedMetadata');
            sandbox.stub(ChaincodeFromContract.prototype, '_augmentMetadataFromCode').returns({});
            sandbox.stub(ChaincodeFromContract.prototype, '_compileSchemas');

            sandbox.stub(Reflect, 'getMetadata').returns(['info']);

            new ChaincodeFromContract([SCDelta], defaultSerialization);

            sinon.assert.calledOnce(_checkSuppliedStub);
        });
    });

    describe('#_augmentMetadataFromCode', () => {
        const exampleMetadata = {
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

        it('should add extra detail if the contracts element is left blank meaning that just info is being added', () => {
            const fakeCcfc = {
                contractImplementations: {
                    myContract: {
                        contractInstance: {
                            name: 'some name',
                            _someProperty: 'should ignore'
                        }
                    }
                },
                _augmentMetadataFromCode: ChaincodeFromContract.prototype._augmentMetadataFromCode
            };
            const partialMetadata = {
                info: {
                    version: '0.1.1',
                    title: 'some title'
                }
            };
            const metadata = fakeCcfc._augmentMetadataFromCode(partialMetadata);

            const correctData =       {
                'components': {
                    'schemas': {}
                },
                'contracts': {
                    'myContract': {
                        'contractInstance': {
                            'name': 'some name'
                        }
                    }
                },
                'info': {
                    'title': 'some title',
                    'version': '0.1.1'
                }
            };


            metadata.should.deep.equal(correctData);
        });

        it ('should handle contracts and remove underscore lead properties of contractInstance', () => {
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
                _augmentMetadataFromCode: ChaincodeFromContract.prototype._augmentMetadataFromCode
            };

            const metadata = fakeCcfc._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal({
                myContract: {
                    contractInstance: {
                        name: 'some name'
                    }
                }
            });
            fakeCcfc.contractImplementations.myContract.contractInstance._someProperty.should.deep.equal('should ignore');
            metadata.info.should.deep.equal(metadataToSend.info);
            metadata.components.should.deep.equal(metadataToSend.components);
        });

        it ('should fill in info field when not set with package.json data', () => {
            const metadataToSend = {
                contracts: exampleMetadata.contracts,
                components: exampleMetadata.components
            };

            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal({
                version: '1.0.1',
                title: 'some package'
            });
            metadata.components.should.deep.equal(metadataToSend.components);
        });

        it ('should fill in info field when not set and package.json missing data', () => {
            const metadataToSend = {
                contracts: exampleMetadata.contracts,
                components: exampleMetadata.components
            };

            mockery.deregisterMock('packagejson');
            mockery.registerMock('packagejson', {});

            const metadata = ChaincodeFromContract.prototype._augmentMetadataFromCode(metadataToSend);
            metadata.contracts.should.deep.equal(metadataToSend.contracts);
            metadata.info.should.deep.equal({
                version: '',
                title: ''
            });
            metadata.components.should.deep.equal(metadataToSend.components);
        });

        it ('should fill in components field when not set', () => {
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

        it ('should fill in components field when not set and reflect fails', () => {
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
