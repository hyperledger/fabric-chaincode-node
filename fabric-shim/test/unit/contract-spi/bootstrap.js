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
/*global describe it beforeEach afterEach  */
'use strict';

const chai = require('chai');
chai.should();

chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');
const mockery = require('mockery');

const path = require('path');
// class under test
const pathToRoot = '../../../..';
const bootstrap = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/bootstrap'));
const Contract = require('fabric-contract-api').Contract;
const ChaincodeFromContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/chaincodefromcontract'));

const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));

function log(...e){
	// eslint-disable-next-line no-console
	console.log(...e);
}

describe('contract.js', () => {

	/**
     * A fake  contract class; pure loading tests in this file
     */
	class sc extends Contract {
		/** */
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

		it('should pass on the register to the shim', () => {
			sandbox.stub(shim, 'start');
			bootstrap.register([sc]);
			sinon.assert.calledOnce(shim.start);
		});

	});

	describe('#bootstrap', () => {

		beforeEach('enable mockery', () => {
			mockery.enable();
		});

		afterEach('disable mockery', () => {
			mockery.disable();
		});

		it('should use the package.json for the names classes; incorrect spec', () => {
			sandbox.stub(path, 'resolve').withArgs(sinon.match.any,'..','..','..','..',sinon.match(/package.json/)).returns('jsoncfg');
			mockery.registerMock('jsoncfg', { contracts: 'nonexistant' });
			(() => {
				bootstrap.bootstrap();
			}).should.throw(/not usable/);
		});


		it('should use the package.json for the names classes; incorrect spec', () => {
			sandbox.stub(path, 'resolve').returns('jsoncfg');
			mockery.registerMock('jsoncfg', {
				contracts:  {
					classes:['nonexistant']
				}
			});

			(() => {
				bootstrap.bootstrap();
			}).should.throw(/is not a constructor/);
		});

		it('should use the package.json for the names classes; valid spec', () => {

			mockery.registerMock('jsoncfg', {
				contracts:  {
					classes:['sensibleContract']
				}
			});
			sandbox.stub(shim, 'start');
			let resolveStub = sandbox.stub(path, 'resolve');
			resolveStub.withArgs(sinon.match.any,'..','..','..','..',sinon.match(/package.json/)).returns('jsoncfg');
			resolveStub.withArgs(sinon.match.any,'..','..','..',sinon.match(/sensibleContract/)).returns('sensibleContract');

			mockery.registerMock('sensibleContract',sc);
			bootstrap.bootstrap();
			sinon.assert.calledOnce(shim.start);
			sinon.assert.calledWith(shim.start,sinon.match.instanceOf(ChaincodeFromContract));
		});

		it('should use the main class defined in the package.json', () => {
			mockery.registerMock('cfgmain.json', {
				main: 'entrypoint'
			});
			mockery.registerMock('entryPoint', sc);
			sandbox.stub(shim, 'start');
			let resolveStub = sandbox.stub(path, 'resolve');
			resolveStub.withArgs(sinon.match.any,'..','..','..','..',sinon.match(/package.json/)).returns('cfgmain.json');
			resolveStub.withArgs(sinon.match.any,'..','..','..','..',sinon.match(/entrypoint/)).returns('sensibleContract');

			bootstrap.bootstrap();
			sinon.assert.calledOnce(shim.start);
			sinon.assert.calledWith(shim.start,sinon.match.instanceOf(ChaincodeFromContract));

		});

		it('should use the main class defined with contracts exported', () => {
			mockery.registerMock('cfgmain2.json', {
				main: 'entrypoint2'
			});
			mockery.registerMock('entryPoint2',{contracts:[sc]});
			sandbox.stub(shim, 'start');
			let resolveStub = sandbox.stub(path, 'resolve');
			resolveStub.withArgs(sinon.match.any,'..','..','..','..',sinon.match(/package.json/)).returns('cfgmain2.json');
			resolveStub.withArgs(sinon.match.any,'..','..','..','..',sinon.match(/entrypoint2/)).returns('entryPoint2');

			bootstrap.bootstrap();
			sinon.assert.calledOnce(shim.start);
			sinon.assert.calledWith(shim.start,sinon.match.instanceOf(ChaincodeFromContract));

		});

		it('should throw an error if none of the other methods work', () => {

			mockery.registerMock('another.json', {
				author: 'fred'
			});
			let resolveStub = sandbox.stub(path, 'resolve');
			resolveStub.withArgs(sinon.match.any,'..','..','..','..',sinon.match(/package.json/)).returns('another.json');
			(()=>{
				bootstrap.bootstrap();
			}).should.throw(/Can not detect any of the indications of how this is a contract instance/);
		});

	});


});
