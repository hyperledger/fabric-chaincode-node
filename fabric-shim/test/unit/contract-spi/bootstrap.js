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
/* global describe it beforeEach afterEach after */
/* eslint-disable no-console */
'use strict';

const chai = require('chai');
chai.should();

chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');
const mockery = require('mockery');
const rewire = require('rewire');

const path = require('path');
// class under test
const pathToRoot = '../../../..';
const bootstrap = rewire(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/bootstrap'));
const Contract = require('fabric-contract-api').Contract;
const StartCommand = require('../../../lib/cmds/startCommand.js');

const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));

function log(...e) {
    console.log(...e);
}

describe('bootstrap.js', () => {

    /**
     * A fake  contract class; pure loading tests in this file
     */
    class sc extends Contract {
        constructor() {
            super();
        }
        /**
         * @param {object} api api
         */
        alpha(api) {
            log(api);
        }
    }

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#register', () => {

        it ('should pass on the register to the shim', () => {
            let testArgs;

            class MockChaincodeFromContract {
                constructor(contractClasses) {
                    testArgs = contractClasses;
                }
            }

            const cfcClass = bootstrap.__get__('ChaincodeFromContract');
            bootstrap.__set__('ChaincodeFromContract', MockChaincodeFromContract);

            sandbox.stub(shim, 'start');
            bootstrap.register([sc]);

            testArgs.should.deep.equal([sc]);
            sinon.assert.calledOnce(shim.start);

            bootstrap.__set__('ChaincodeFromContract', cfcClass);
        });

    });

    describe('#bootstrap', () => {
        const theirYargs = bootstrap.__get__('yargs');
        const myYargs = {'argv': {'$0': 'fabric-chaincode-node', 'peer.address': 'localhost:7051', 'chaincode-id-name': 'mycc'}};

        let getArgsStub;
        let pathStub;
        let registerStub;
        let ogRegister;

        beforeEach('enable mockery', () => {
            mockery.enable();

            bootstrap.__set__('yargs', myYargs);

            getArgsStub = sinon.stub(StartCommand, 'getArgs').returns({
                'module-path': '/some/path'
            });

            pathStub = sandbox.stub(path, 'resolve');
            pathStub.withArgs(sinon.match.any, '/some/path').returns('/some/path');
            pathStub.withArgs('/some/path', 'package.json').returns('jsoncfg');

            registerStub = sinon.stub();

            ogRegister = bootstrap.__get__('register');
            bootstrap.__set__('register', registerStub);
        });

        afterEach('disable mockery', () => {
            mockery.disable();

            getArgsStub.restore();
        });

        after(() => {
            bootstrap.__set__('yargs', theirYargs);
            bootstrap.__set__('register', ogRegister);
        });

        it ('should use the main class defined in the package.json', () => {
            mockery.registerMock('jsoncfg', {
                main: 'entrypoint'
            });

            sandbox.stub(shim, 'start');

            pathStub.withArgs('/some/path', 'entrypoint').returns('entryPoint');

            mockery.registerMock('entryPoint', sc);
            mockery.registerMock('sensibleContract', sc);
            bootstrap.bootstrap();
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc]);

        });

        it ('should use the main class defined with contracts exported', () => {
            mockery.registerMock('jsoncfg', {
                main: 'entrypoint2'
            });

            sandbox.stub(shim, 'start');

            pathStub.withArgs('/some/path', 'entrypoint2').returns('entryPoint2');

            mockery.registerMock('entryPoint2', {contracts: [sc]});
            bootstrap.bootstrap();
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc]);
        });

        it ('should use the main class defined with contracts exported, and custom serialization', () => {
            mockery.registerMock('jsoncfg', {
                main: 'entrypoint2'
            });

            sandbox.stub(shim, 'start');

            pathStub.withArgs('/some/path', 'entrypoint2').returns('entryPoint2');

            mockery.registerMock('entryPoint2',
                {
                    contracts: [sc],
                    serializers : {
                        transaction: 'wibble',
                        serializers: {
                            'wibble':'wibbleimpl'
                        }
                    }
                });
            bootstrap.bootstrap();
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc]);
        });

        it ('should use the main class defined with contracts exported, and custom serialization', () => {
            mockery.registerMock('jsoncfg', {
                main: 'entrypoint2'
            });

            sandbox.stub(shim, 'start');

            pathStub.withArgs('/some/path', 'entrypoint2').returns('entryPoint2');

            mockery.registerMock('entryPoint2',
                {
                    contracts: [sc],
                    serializers : {
                        serializers: {
                            'wibble':'wibbleimpl'
                        }
                    }
                });
            (() => {
                bootstrap.bootstrap();
            }).should.throw(/There should be a 'transaction' property to define the serializer for use with transactions/);

        });

        it ('should throw an error if none of the other methods work', () => {
            path.resolve.restore();
            pathStub = sandbox.stub(path, 'resolve');

            pathStub.returns('another.json');

            mockery.registerMock('another.json', {
                author: 'fred'
            });

            (() => {
                bootstrap.bootstrap();
            }).should.throw(/Can not detect any of the indications of how this is a contract instance/);
        });

    });


});
