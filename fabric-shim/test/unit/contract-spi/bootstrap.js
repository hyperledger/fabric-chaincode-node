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
const ChaincodeFromContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/chaincodefromcontract'));
const StartCommand = require('../../../lib/cmds/startCommand.js');

const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));

function log(...e) {
    console.log(...e);
}

describe('contract.js', () => {

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
            sandbox.stub(shim, 'start');
            bootstrap.register([sc]);
            sinon.assert.calledOnce(shim.start);
        });

    });

    describe('#bootstrap', () => {
        const theirYargs = bootstrap.__get__('yargs');
        const myYargs = {'argv': {'$0': 'fabric-chaincode-node', 'peer.address': 'localhost:7051', 'chaincode-id-name': 'mycc'}};

        let getArgsStub;
        let pathStub;

        beforeEach('enable mockery', () => {
            mockery.enable();

            bootstrap.__set__('yargs', myYargs);

            getArgsStub = sinon.stub(StartCommand, 'getArgs').returns({
                'module-path': '/some/path'
            });

            pathStub = sandbox.stub(path, 'resolve');
            pathStub.withArgs(sinon.match.any, '/some/path').returns('/some/path');
            pathStub.withArgs('/some/path', 'package.json').returns('jsoncfg');
        });

        afterEach('disable mockery', () => {
            mockery.disable();

            getArgsStub.restore();
        });

        after(() => {
            bootstrap.__set__('yargs', theirYargs);
        });

        it ('should use the package.json for the names classes; incorrect spec', () => {
            mockery.registerMock('jsoncfg', {contracts: 'nonexistant'});
            (() => {
                bootstrap.bootstrap();
            }).should.throw(/not usable/);

            sinon.assert.calledOnce(getArgsStub);
            sinon.assert.calledWith(getArgsStub, myYargs);
        });


        it ('should use the package.json for the names classes; incorrect spec', () => {
            pathStub.withArgs('/some/path', 'nonexistant').returns('jsoncfg');

            mockery.registerMock('jsoncfg', {
                contracts:  {
                    classes:['nonexistant']
                }
            });

            (() => {
                bootstrap.bootstrap();
            }).should.throw(/is not a constructor/);
        });

        it ('should use the package.json for the names classes; valid spec', () => {

            mockery.registerMock('jsoncfg', {
                contracts:  {
                    classes:['sensibleContract']
                }
            });
            sandbox.stub(shim, 'start');

            pathStub.withArgs('/some/path', sinon.match(/sensibleContract/)).returns('sensibleContract');

            mockery.registerMock('sensibleContract', sc);
            bootstrap.bootstrap();
            sinon.assert.calledOnce(shim.start);
            sinon.assert.calledWith(shim.start, sinon.match.instanceOf(ChaincodeFromContract));
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
            sinon.assert.calledOnce(shim.start);
            sinon.assert.calledWith(shim.start, sinon.match.instanceOf(ChaincodeFromContract));

        });

        it ('should use the main class defined with contracts exported', () => {
            mockery.registerMock('jsoncfg', {
                main: 'entrypoint2'
            });

            sandbox.stub(shim, 'start');

            pathStub.withArgs('/some/path', 'entrypoint2').returns('entryPoint2');

            mockery.registerMock('entryPoint2', {contracts:[sc]});
            bootstrap.bootstrap();
            sinon.assert.calledOnce(shim.start);
            sinon.assert.calledWith(shim.start, sinon.match.instanceOf(ChaincodeFromContract));
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
