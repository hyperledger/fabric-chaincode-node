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
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const mockery = require('mockery');
const rewire = require('rewire');

// standard utility fns
const path = require('path');

// class under test
const pathToRoot = '../../../..';

const Contract = require('fabric-contract-api').Contract;
const Context = require(path.join(pathToRoot, 'fabric-contract-api/lib/context'));
const JSONSerializer = require(path.join(pathToRoot, 'fabric-contract-api/lib/jsontransactionserializer.js'));
const ChaincodeFromContract = rewire(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/chaincodefromcontract'));
const SystemContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/systemcontract'));
const StartCommand = require(path.join(pathToRoot, 'fabric-shim/lib/cmds/startCommand.js'));
const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));
const FabricStubInterface = require(path.join(pathToRoot, 'fabric-shim/lib/stub'));
console.log(JSONSerializer);
const defaultSerialization = {
    transaction: 'jsonSerializer',
    serializers: {
        jsonSerializer : JSONSerializer
    }
};
let alphaStub;
let betaStub;

let beforeFnStubA;
let afterFnStubA;
let unknownStub;
let privateStub;
let ctxStub;

function log(...e) {
    // eslint-disable-next-line
    console.log(...e);
}

describe('chaincodefromcontract', () => {

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

    let sandbox;
    let getArgsStub;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
        beforeFnStubA = sandbox.stub().named('beforeFnStubA');
        afterFnStubA = sandbox.stub().named('afterFnStubA');
        alphaStub = sandbox.stub().named('alphaStub');
        betaStub = sandbox.stub().named('betaStub');
        getArgsStub = sandbox.stub(StartCommand, 'getArgs').returns({
            'module-path': '/some/path'
        });

        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        mockery.registerMock('./systemcontract', SystemContract);

        const pathStub = sandbox.stub(path, 'resolve');
        pathStub.withArgs(sinon.match.any, '/some/path').returns('/some/path');
        pathStub.withArgs('/some/path', 'package.json').returns('packagejson');

        const mock = {
            version: '1.0.1',
            name: 'some package'
        };

        mockery.registerMock('packagejson', mock);
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
        mockery.disable();
    });

    describe('#constructor', () => {

        it ('should handle no classes being passed in', () => {
            (() => {
                new ChaincodeFromContract();
            }).should.throw(/Missing argument/);
        });

        it ('should handle classes that are not of the correct type', () => {
            const tempClass =   class {
                constructor() {}
            };

            (() => {
                new ChaincodeFromContract([
                    tempClass
                ], defaultSerialization);
            }).should.throw(/invalid contract/);
        });

        it ('should handle missing serialization information', () => {
            const tempClass =   class {
                constructor() {}
            };

            (() => {
                new ChaincodeFromContract([
                    tempClass
                ]);
            }).should.throw(/Missing argument/);
        });

        it ('should correctly create valid chaincode instance', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata')
                .onFirstCall().returns(['some', 'transactions'])
                .onSecondCall().returns(['some', 'transactions'])
                .onCall(3).returns({'some': 'objects'});

            SCBeta.prototype.fred = 'fred';
            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);

            // get the contracts that have been defined
            expect(cc.contracts).to.have.keys('alpha', 'beta', 'org.hyperledger.fabric');
            expect(cc.contracts.alpha).to.include.keys('transactions');
            expect(cc.contracts.beta).to.include.keys('transactions');
            expect(cc.contracts.alpha.transactions).to.deep.equal(['some', 'transactions']);
            expect(cc.contracts.beta.transactions).to.deep.equal(['some', 'transactions']);

            sinon.assert.callCount(getMetadataStub, 4);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', new(SCAlpha));
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', new(SCBeta));
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);

            sinon.assert.calledOnce(getArgsStub);
            expect(cc.version).to.deep.equal('1.0.1');
            expect(cc.title).to.deep.equal('some package');
            expect(cc.objects).to.deep.equal({'some': 'objects'});
        });

        it ('should correctly create valid chaincode instance when package.json does not have version or name', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata')
                .onFirstCall().returns(['some', 'transactions'])
                .onSecondCall().returns(['some', 'transactions'])
                .onCall(3).returns({'some': 'objects'});

            const mock = {};

            mockery.deregisterMock('packagejson');
            mockery.registerMock('packagejson', mock);

            SCBeta.prototype.fred = 'fred';
            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);

            // get the contracts that have been defined
            expect(cc.contracts).to.have.keys('alpha', 'beta', 'org.hyperledger.fabric');
            expect(cc.contracts.alpha).to.include.keys('transactions');
            expect(cc.contracts.beta).to.include.keys('transactions');
            expect(cc.contracts.alpha.transactions).to.deep.equal(['some', 'transactions']);
            expect(cc.contracts.beta.transactions).to.deep.equal(['some', 'transactions']);

            sinon.assert.callCount(getMetadataStub, 4);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', new(SCAlpha));
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', new(SCBeta));
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);

            sinon.assert.calledOnce(getArgsStub);
            expect(cc.version).to.deep.equal('');
            expect(cc.title).to.deep.equal('');
        });

        it ('should handle when reflect cannot get metadata', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata')
                .onFirstCall().returns(undefined)
                .onSecondCall().returns(undefined)
                .onCall(3).returns(undefined);

            const mock = {};

            mockery.registerMock('packagejson', mock);

            SCBeta.prototype.fred = 'fred';
            const cc = new ChaincodeFromContract([SCBeta], defaultSerialization);

            // get the contracts that have been defined
            expect(cc.contracts).to.have.keys('beta', 'org.hyperledger.fabric');
            expect(cc.contracts.beta).to.include.keys('transactions');
            expect(cc.contracts.beta.transactions).to.deep.equal([{name: 'beta'}, {name: 'afterTransaction'}, {name: 'beforeTransaction'}, {name: 'unknownTransaction'}, {name: 'createContext'}]);

            sinon.assert.calledThrice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', new(SCBeta));
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', new(SCBeta));
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);

            sinon.assert.calledOnce(getArgsStub);
            expect(cc.version).to.deep.equal('');
            expect(cc.title).to.deep.equal('');
            expect(cc.objects).to.deep.equal({});
        });
    });

    describe('#init', () => {

        it ('should call the invokeFunctionality method', async () => {
            const stubInterface = sinon.createStubInstance(FabricStubInterface);
            stubInterface.getFunctionAndParameters.returns({
                fcn:'alpha:alpha',
                params: ['arg1', 'arg2']
            });
            const fakesuccess = sinon.fake((e) => {
                log(e);
            });
            sandbox.replace(shim, 'success', fakesuccess);

            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);
            sandbox.stub(cc, 'invokeFunctionality');

            await cc.Init(stubInterface);
            sinon.assert.calledOnce(cc.invokeFunctionality);
            sinon.assert.calledWith(cc.invokeFunctionality, stubInterface);
            sinon.assert.notCalled(fakesuccess);

        });

        it ('should return a shim.success when no args are passed through the init function', async () => {
            const stubInterface = sinon.createStubInstance(FabricStubInterface);
            stubInterface.getFunctionAndParameters.returns({
                fcn: '',
                params: []
            });
            const fakesuccess = sinon.fake((e) => {
                log(e);
            });
            sandbox.replace(shim, 'success', fakesuccess);

            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);
            sandbox.stub(cc, 'invokeFunctionality');

            await cc.Init(stubInterface);
            sinon.assert.calledOnce(fakesuccess);
            sinon.assert.notCalled(cc.invokeFunctionality);

        });

    });

    describe('#invoke', () => {

        it ('should call the invokeFunctionality method', async () => {
            const stubInterface = sinon.createStubInstance(FabricStubInterface);
            stubInterface.getFunctionAndParameters.returns({
                fcn:'alpha:alpha',
                params: ['arg1', 'arg2']
            });

            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);
            sandbox.stub(cc, 'invokeFunctionality');
            await cc.Invoke(stubInterface);

            sinon.assert.calledOnce(cc.invokeFunctionality);
            sinon.assert.calledWith(cc.invokeFunctionality, stubInterface);

        });

    });

    describe('#invokeFunctionality', () => {

        let fakeSuccess;
        let fakeError;

        let defaultBeforeSpy;
        let defaultAfterSpy;
        let defaultCreateContext;

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

        let cc;

        beforeEach(() => {
            cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);

            defaultBeforeSpy = sandbox.spy(Contract.prototype, 'beforeTransaction');
            defaultAfterSpy = sandbox.spy(Contract.prototype, 'afterTransaction');
            defaultCreateContext = sandbox.spy(Contract.prototype, 'createContext');
        });

        describe('expected successful', () => {
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

            it ('should invoke the alpha function', async () => {
                alphaStub.resolves('Hello');
                beforeFnStubA.resolves();
                afterFnStubA.resolves();

                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'alpha:alpha',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );

                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(alphaStub);
                sinon.assert.calledWith(alphaStub, sinon.match.any, 'arg1', 'arg2');
                sinon.assert.calledOnce(defaultBeforeSpy);
                sinon.assert.calledOnce(defaultAfterSpy);
                sinon.assert.calledOnce(defaultCreateContext);
                sinon.assert.callOrder(defaultCreateContext, defaultBeforeSpy, alphaStub, defaultAfterSpy);
                expect(Buffer.isBuffer(fakeSuccess.getCall(0).args[0])).to.be.ok;
                expect(fakeSuccess.getCall(0).args[0].toString()).to.deep.equal('"Hello"');
            });

            it ('should invoke the alpha function handling non-string response', async () => {
                alphaStub.resolves(123);
                beforeFnStubA.resolves();
                afterFnStubA.resolves();

                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'alpha:alpha',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );

                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(alphaStub);
                sinon.assert.calledWith(alphaStub, sinon.match.any, 'arg1', 'arg2');
                sinon.assert.calledOnce(defaultBeforeSpy);
                sinon.assert.calledOnce(defaultAfterSpy);
                sinon.assert.calledOnce(defaultCreateContext);
                sinon.assert.callOrder(defaultCreateContext, defaultBeforeSpy, alphaStub, defaultAfterSpy);
                expect(Buffer.isBuffer(fakeSuccess.getCall(0).args[0])).to.be.ok;
                expect(fakeSuccess.getCall(0).args[0].toString()).to.deep.equal('123');
            });

            it ('should invoke alpha and handle when function response is a buffer', async () => {
                alphaStub.resolves(Buffer.from('hello'));
                beforeFnStubA.resolves();
                afterFnStubA.resolves();

                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'alpha:alpha',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );

                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(alphaStub);
                sinon.assert.calledWith(alphaStub, sinon.match.any, 'arg1', 'arg2');
                sinon.assert.calledOnce(defaultBeforeSpy);
                sinon.assert.calledOnce(defaultAfterSpy);
                sinon.assert.calledOnce(defaultCreateContext);
                sinon.assert.callOrder(defaultCreateContext, defaultBeforeSpy, alphaStub, defaultAfterSpy);
                expect(Buffer.isBuffer(fakeSuccess.getCall(0).args[0])).to.be.ok;
                expect(fakeSuccess.getCall(0).args[0].toString()).to.deep.equal('{"type":"Buffer","data":[104,101,108,108,111]}');
            });

            it ('should invoke alpha and handle when function response is an array', async () => {
                alphaStub.resolves([1, 2, 3, 4]);
                beforeFnStubA.resolves();
                afterFnStubA.resolves();

                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'alpha:alpha',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );


                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(alphaStub);
                sinon.assert.calledWith(alphaStub, sinon.match.any, 'arg1', 'arg2');
                sinon.assert.calledOnce(defaultBeforeSpy);
                sinon.assert.calledOnce(defaultAfterSpy);
                sinon.assert.calledOnce(defaultCreateContext);
                sinon.assert.callOrder(defaultCreateContext, defaultBeforeSpy, alphaStub, defaultAfterSpy);
                expect(Buffer.isBuffer(fakeSuccess.getCall(0).args[0])).to.be.ok;
                expect(fakeSuccess.getCall(0).args[0].toString()).to.deep.equal('[1,2,3,4]');
            });

            it ('should invoke the correct before/after fns function', async () => {
                beforeFnStubA.resolves();
                afterFnStubA.resolves();
                ctxStub = sandbox.createStubInstance(Context);

                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'beta:beta',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );


                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(betaStub);
                sinon.assert.calledOnce(afterFnStubA);
                sinon.assert.calledOnce(beforeFnStubA);
                sinon.assert.callOrder(beforeFnStubA, afterFnStubA);
            });
        });

        describe('expecting error', () => {

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

            it ('should correctly handle case of failing before hook', async () => {
                beforeFnStubA.rejects(new Error('failure failure'));
                afterFnStubA.resolves();
                ctxStub = sandbox.createStubInstance(Context);

                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'beta:beta',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );


                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(shim.error);
                expect(fakeError.args[0][0]).to.be.instanceOf(Error);
                expect(fakeError.args[0][0].toString()).to.match(/failure failure/);
                sinon.assert.notCalled(betaStub);
                sinon.assert.notCalled(afterFnStubA);

                sinon.assert.calledOnce(beforeFnStubA);
            });

            it ('should throw correct error with missing name', async () => {
                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'wibble:alpha',
                    params: ['arg1', 'arg2']
                });

                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(shim.error);
                expect(fakeError.args[0][0]).to.be.instanceOf(Error);
                expect(fakeError.args[0][0].toString()).to.match(/Error: Contract name is not known :wibble:/);
            });

            it ('should throw correct error with wrong function name', async () => {
                const stubInterface = sinon.createStubInstance(FabricStubInterface);
                stubInterface.getFunctionAndParameters.returns({
                    fcn:'alpha:wibble',
                    params: ['arg1', 'arg2']
                });

                const mockSigningId = {
                    getMspid: sinon.stub(),
                    getIdBytes: sinon.stub().returns(idBytes)
                };
                stubInterface.getCreator.returns(
                    mockSigningId
                );
                await cc.invokeFunctionality(stubInterface, stubInterface.getFunctionAndParameters());
                sinon.assert.calledOnce(shim.error);
                expect(fakeError.args[0][0]).to.be.instanceOf(Error);
                expect(fakeError.args[0][0].toString()).to.match(/Error: You've asked to invoke a function that does not exist/);
            });
        });
    });

    describe('#_splitFunctionName', () => {
        let cc;
        beforeEach(() => {
            // actual contract instance is not important for this test
            cc = new ChaincodeFromContract([SCBeta], defaultSerialization);
        });

        it ('should handle the usual case of ns:fn', () => {
            const result = cc._splitFunctionName('name:function');
            result.should.deep.equal({contractName:'name', function:'function'});
        });

        it ('should handle the case of no contractName explicit', () => {
            const result = cc._splitFunctionName(':function');
            result.should.deep.equal({contractName:'', function:'function'});
        });

        it ('should handle the case of no contractName implict', () => {
            const result = cc._splitFunctionName('function');
            result.should.deep.equal({contractName:'', function:'function'});
        });

        it ('should handle the case of no input', () => {
            const result = cc._splitFunctionName('');
            result.should.deep.equal({contractName:'', function:''});
        });

        it ('should handle the case of multiple :', () => {
            const result = cc._splitFunctionName('name:function:with:colons:');
            result.should.deep.equal({contractName:'name', function:'function:with:colons:'});
        });
    });

    describe('getContracts', () => {
        it ('should return the contract info', async () => {
            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);
            cc.title = 'some title';
            cc.version = '0.0.1';
            cc.objects = {
                'some': 'objects'
            };

            const info = cc.getContracts();

            expect(info).to.deep.equal({
                info: {
                    title: 'some title',
                    version: '0.0.1'
                },
                contracts: [{
                    info: {
                        title: 'alpha',
                        version: '0.0.1'
                    },
                    transactions: [{
                        name: 'alpha'
                    }],
                    name: 'alpha'
                }, {
                    info: {
                        title: 'beta',
                        version: '0.0.1'
                    },
                    transactions: [{
                        name: 'beta'
                    }, {
                        name: 'afterTransaction'
                    }, {
                        name: 'beforeTransaction'
                    }, {
                        name: 'unknownTransaction'
                    }, {
                        name: 'createContext'
                    }],
                    name: 'beta'
                }, {
                    info: {
                        title: 'org.hyperledger.fabric',
                        version: '0.0.1'
                    },
                    transactions: [{
                        name: 'GetMetadata'
                    }],
                    name: 'org.hyperledger.fabric'
                }],
                components: {
                    schemas: {
                        'some': 'objects'
                    }
                }
            });
        });

        it ('should not include components.schema when empty', () => {
            const cc = new ChaincodeFromContract([SCAlpha, SCBeta], defaultSerialization);
            cc.title = 'some title';
            cc.version = '0.0.1';
            cc.objects = {};

            const info = cc.getContracts();

            expect(info).to.deep.equal({
                info: {
                    title: 'some title',
                    version: '0.0.1'
                },
                contracts: [{
                    info: {
                        title: 'alpha',
                        version: '0.0.1'
                    },
                    transactions: [{
                        name: 'alpha'
                    }],
                    name: 'alpha'
                }, {
                    info: {
                        title: 'beta',
                        version: '0.0.1'
                    },
                    transactions: [{
                        name: 'beta'
                    }, {
                        name: 'afterTransaction'
                    }, {
                        name: 'beforeTransaction'
                    }, {
                        name: 'unknownTransaction'
                    }, {
                        name: 'createContext'
                    }],
                    name: 'beta'
                }, {
                    info: {
                        title: 'org.hyperledger.fabric',
                        version: '0.0.1'
                    },
                    transactions: [{
                        name: 'GetMetadata'
                    }],
                    name: 'org.hyperledger.fabric'
                }],
                components: {}
            });
        });
    });
});
